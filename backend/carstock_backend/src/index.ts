import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { createClient } from "@supabase/supabase-js";

// ======================================================
// Clients Supabase
// ======================================================
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!; // clé publique (anon)
const supabaseRoleKey = process.env.SERVICEROLEKEY!; // service role

const supabasePublic = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const supabaseAdmin = createClient(supabaseUrl, supabaseRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ======================================================
// Fonction commune : création d'un compte client
// ======================================================
async function createClientAccount(input: {
  email: string;
  password: string;
  name: string;
  contact?: string | null;
  details?: string | null;
  start_date?: string | null;
  photo?: File;
}) {
  const { email, password, name, contact, details, start_date, photo } = input;

  // 1. Création du compte Auth (envoie l'e-mail de confirmation)
  const { data: authData, error: signUpError } =
    await supabasePublic.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

  if (signUpError) {
    throw new Error(signUpError.message);
  }

  const user = authData.user;

  // Cas e-mail déjà utilisé
  if (!user || (user.identities && user.identities.length === 0)) {
    throw new Error("Cette adresse e-mail est déjà utilisée.");
  }

  const userId = user.id;

  try {
    // 2. Upload photo (optionnel)
    let photoUrl: string | null = null;

    if (photo) {
      const photoPath = `client/${userId}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("avatars")
        .upload(photoPath, photo, {
          contentType: photo.type || "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Échec upload photo : ${uploadError.message}`);
      }

      photoUrl = supabaseAdmin.storage
        .from("avatars")
        .getPublicUrl(photoPath).data.publicUrl;
    }

    // 3. Insertion public.users
    const { error: userError } = await supabaseAdmin.from("users").insert({
      id: userId,
      email,
      name,
    });

    if (userError) throw new Error(`Erreur users : ${userError.message}`);

    // 4. Insertion public.client
    const { error: clientError } = await supabaseAdmin.from("client").insert({
      id: userId,
      contact: contact ?? null,
      details: details ?? null,
      photo: photoUrl,
      start_date: start_date ?? null,
    });

    if (clientError) throw new Error(`Erreur client : ${clientError.message}`);

    // 5. Attribution du rôle client
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role_id: "client",
    });

    if (roleError) throw new Error(`Erreur rôle : ${roleError.message}`);

    return {
      id: userId,
      email,
      name,
      contact,
      details,
      photo: photoUrl,
      start_date,
    };
  } catch (err) {
    // Nettoyage en cas d'échec
    try {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    } catch (e) {
      console.error("Échec nettoyage compte Auth:", e);
    }
    throw err;
  }
}

// ======================================================
// Application
// ======================================================
const app = new Elysia()
  .use(
    cors({
      origin: true,
      credentials: true,
    })
  )

  // ----------------------------------------------------
  // LOGIN
  // ----------------------------------------------------
  .post(
    "/api/v1/auth/login",
    async ({ body, set }) => {
      const { email, password } = body;

      const { data, error } = await supabasePublic.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message === "Email not confirmed") {
          set.status = 403;
          return {
            success: false,
            message: "Veuillez confirmer votre e-mail avant de vous connecter.",
          };
        }

        set.status = 401;
        return {
          success: false,
          message: error.message,
        };
      }

      return {
        success: true,
        user: data.user,
        session: data.session,
      };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String(),
      }),
    }
  )

  // ----------------------------------------------------
  // INSCRIPTION PUBLIQUE
  // ----------------------------------------------------
  .post(
    "/api/v1/auth/register",
    async ({ body, set }) => {
      try {
        const client = await createClientAccount(body);

        set.status = 201;
        return {
          success: true,
          message:
            "Compte créé avec succès. Vérifiez votre e-mail pour confirmer l'inscription.",
          data: client,
        };
      } catch (err: any) {
        set.status = 400;
        return {
          success: false,
          message: err.message || "Erreur lors de la création du compte.",
        };
      }
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 8 }),
        name: t.String({ minLength: 2 }),
        contact: t.Optional(t.Nullable(t.String())),
        details: t.Optional(t.Nullable(t.String())),
        start_date: t.Optional(t.Nullable(t.String())),
        photo: t.Optional(t.File()),
      }),
    }
  )

  // ----------------------------------------------------
  // CRÉATION CLIENT PAR ADMIN
  // ----------------------------------------------------
  .post(
    "/api/v1/users/client",
    async ({ body, headers, set }) => {
      const authorization = headers.authorization;

      if (!authorization?.startsWith("Bearer ")) {
        set.status = 401;
        return { success: false, message: "Token manquant." };
      }

      const token = authorization.substring(7);

      const {
        data: { user: currentUser },
        error: authError,
      } = await supabaseAdmin.auth.getUser(token);

      if (authError || !currentUser) {
        set.status = 401;
        return { success: false, message: "Session invalide ou expirée." };
      }

      // Vérification rôle admin dans user_roles
      const { data: adminRole, error: roleError } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("user_id", currentUser.id)
        .eq("role_id", "admin")
        .maybeSingle();

      if (roleError || !adminRole) {
        set.status = 403;
        return {
          success: false,
          message: "Accès réservé aux administrateurs.",
        };
      }

      try {
        const client = await createClientAccount(body);

        set.status = 201;
        return {
          success: true,
          message: "Client créé avec succès. Un e-mail de confirmation a été envoyé.",
          data: client,
        };
      } catch (err: any) {
        set.status = 400;
        return {
          success: false,
          message: err.message || "Erreur lors de la création du client.",
        };
      }
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 8 }),
        name: t.String({ minLength: 2 }),
        contact: t.Optional(t.Nullable(t.String())),
        details: t.Optional(t.Nullable(t.String())),
        start_date: t.Optional(t.Nullable(t.String())),
        photo: t.Optional(t.File()),
      }),
    }
  )

  // ----------------------------------------------------
  // ROUTES VOITURES
  // ----------------------------------------------------
  .get("/api/v1/cars", async ({ headers, set }) => {
    const authorization = headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      set.status = 401;
      return { success: false, message: "Token manquant" };
    }

    const token = authorization.substring(7);
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from("cars")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      set.status = 400;
      return { success: false, message: error.message };
    }

    return { success: true, data };
  })

  .get("/api/v1/cars/:id", async ({ params, headers, set }) => {
    const authorization = headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      set.status = 401;
      return { success: false, message: "Token manquant" };
    }

    const token = authorization.substring(7);
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from("cars")
      .select("*, car_images(*)")
      .eq("id", params.id)
      .maybeSingle();

    if (error) {
      set.status = 400;
      return { success: false, message: error.message };
    }

    if (!data) {
      set.status = 404;
      return { success: false, message: "Voiture introuvable" };
    }

    return { success: true, data };
  })

  .post(
    "/api/v1/cars",
    async ({ body, headers, set }) => {
      const authorization = headers.authorization;
      if (!authorization?.startsWith("Bearer ")) {
        set.status = 401;
        return { success: false, message: "Token manquant" };
      }

      const token = authorization.substring(7);
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: userData, error: authError } =
        await supabase.auth.getUser(token);

      if (authError || !userData.user) {
        set.status = 401;
        return { success: false, message: "Token invalide" };
      }

      const { data, error } = await supabase
        .from("cars")
        .insert({ ...body, created_by: userData.user.id })
        .select()
        .single();

      if (error) {
        set.status = 400;
        return { success: false, message: error.message };
      }

      return { success: true, data };
    },
    {
      body: t.Object({
        brand: t.String(),
        model: t.String(),
        year: t.Number(),
        price: t.Number(),
        currency_code: t.String(),
        mileage: t.Optional(t.Number()),
        fuel_type: t.Optional(t.String()),
        transmission: t.Optional(t.String()),
        color: t.Optional(t.String()),
        description: t.Optional(t.String()),
        status: t.Optional(
          t.Union([
            t.Literal("draft"),
            t.Literal("available"),
            t.Literal("reserved"),
            t.Literal("sold"),
          ])
        ),
      }),
    }
  )

  .patch(
    "/api/v1/cars/:id",
    async ({ params, body, headers, set }) => {
      const authorization = headers.authorization;
      if (!authorization?.startsWith("Bearer ")) {
        set.status = 401;
        return { success: false, message: "Token manquant" };
      }

      const token = authorization.substring(7);
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data, error } = await supabase
        .from("cars")
        .update(body)
        .eq("id", params.id)
        .select()
        .single();

      if (error) {
        set.status = 400;
        return { success: false, message: error.message };
      }

      return { success: true, data };
    },
    {
      body: t.Partial(
        t.Object({
          brand: t.String(),
          model: t.String(),
          year: t.Number(),
          price: t.Number(),
          currency_code: t.String(),
          mileage: t.Number(),
          fuel_type: t.String(),
          transmission: t.String(),
          color: t.String(),
          description: t.String(),
          status: t.Union([
            t.Literal("draft"),
            t.Literal("available"),
            t.Literal("reserved"),
            t.Literal("sold"),
          ]),
        })
      ),
    }
  )

  .delete("/api/v1/cars/:id", async ({ params, headers, set }) => {
    const authorization = headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      set.status = 401;
      return { success: false, message: "Token manquant" };
    }

    const token = authorization.substring(7);
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await supabase.from("cars").delete().eq("id", params.id);

    if (error) {
      set.status = 400;
      return { success: false, message: error.message };
    }

    return { success: true, message: "Voiture supprimée avec succès" };
  })

  // Route de test
  .get("/", () => ({
    success: true,
    message: "CarStock API is running",
  }))

  .listen(process.env.PORT || 3000);

console.log(`✅ Server running on http://localhost:${app.server?.port}`);