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

const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);


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
  // ======================================================
// INSCRIPTION PUBLIQUE CLIENT
// ======================================================

.post(
  "/api/v1/auth/register",
  async ({ body, set }) => {
    const {
      email,
      password,
      name,
      contact,
      details,
      start_date,
      photo,
    } = body;

    let userId: string | null = null;
    let photoPath: string | null = null;

    try {
      // 1. Create user in Supabase Auth
      const { data: createdUser, error } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true, // compte immédiatement confirmé
          user_metadata: {
            name,
            roles: ["client"],
            status: "active",
          },
        });

      if (error || !createdUser.user?.id) {
        set.status = 400;
        return {
          success: false,
          message: error?.message ?? "Failed to create user",
        };
      }

      userId = createdUser.user.id;

      // 2. Upload photo (optionnel)
      let photoUrl: string | null = null;

      if (photo) {
        photoPath = `client/${userId}/${Date.now()}.jpg`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from("avatars")
          .upload(photoPath, photo, {
            contentType: photo.type || "image/jpeg",
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Failed to upload photo: ${uploadError.message}`);
        }

        photoUrl = supabaseAdmin.storage
          .from("avatars")
          .getPublicUrl(photoPath).data.publicUrl;
      }

      // 3. Insert into public.users
      const { error: userError } = await supabaseAdmin.from("users").insert({
        id: userId,
        email,
        name,
        status: "active",
      });

      if (userError) {
        throw new Error(`Users insertion: ${userError.message}`);
      }

      // 4. Insert into public.client
      const { error: clientError } = await supabaseAdmin.from("client").insert({
        id: userId,
        contact: contact ?? null,
        details: details ?? null,
        photo: photoUrl,
        start_date: start_date ?? new Date().toISOString().split("T")[0],
      });

      if (clientError) {
        throw new Error(`Client insertion: ${clientError.message}`);
      }

      // 5. Assign client role
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: userId,
          role_id: "client",
        });

      if (roleError) {
        throw new Error(`Role insertion: ${roleError.message}`);
      }

      // 6. Success
      set.status = 201;
      return {
        success: true,
        message: "Client registered successfully.",
        user: {
          id: userId,
          email,
          name,
          contact,
          details,
          photo: photoUrl,
          role: "client",
          status: "active",
        },
      };
    } catch (error) {
      console.error("❌ REGISTER ERROR:", error);

      // Cleanup photo
      if (photoPath) {
        await supabaseAdmin.storage.from("avatars").remove([photoPath]);
      }

      // Cleanup Auth user
      if (userId) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      }

      set.status = 400;
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
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
  // ======================================================
// CRÉATION CLIENT PAR ADMIN
// ======================================================

.post(
  "/api/v1/users/client",
  async ({ body, headers, set }) => {
    const {
      email,
      password,
      name,
      contact,
      details,
      start_date,
      photo,
    } = body;

    let userId: string | null = null;
    let photoPath: string | null = null;

    try {
      // 1. Verify authorization token
      const token = headers.authorization?.replace("Bearer ", "");

      if (!token) {
        set.status = 401;
        return {
          success: false,
          message: "Authorization token missing.",
        };
      }

      const {
        data: { user: currentUser },
        error: authError,
      } = await supabaseAdmin.auth.getUser(token);

      if (authError || !currentUser) {
        set.status = 401;
        return {
          success: false,
          message: "Invalid or expired session.",
        };
      }

      // 2. Verify admin role
      const { data: adminRole, error: roleCheckError } =
        await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("user_id", currentUser.id)
          .eq("role_id", "admin")
          .maybeSingle();

      if (roleCheckError || !adminRole) {
        set.status = 403;
        return {
          success: false,
          message: "Access reserved for administrators.",
        };
      }

      // 3. Create Auth user
      const { data: createdUser, error } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            name,
            roles: ["client"],
            status: "active",
          },
        });

      if (error || !createdUser.user?.id) {
        set.status = 400;
        return {
          success: false,
          message: error?.message ?? "Failed to create client.",
        };
      }

      userId = createdUser.user.id;

      // 4. Upload photo
      let photoUrl: string | null = null;

      if (photo) {
        photoPath = `client/${userId}/${Date.now()}.jpg`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from("avatars")
          .upload(photoPath, photo, {
            contentType: photo.type || "image/jpeg",
            upsert: true,
          });

        if (uploadError) {
          throw new Error(
            `Photo upload failed: ${uploadError.message}`
          );
        }

        photoUrl = supabaseAdmin.storage
          .from("avatars")
          .getPublicUrl(photoPath).data.publicUrl;
      }

      // 5. Insert public.users
      const { error: userError } = await supabaseAdmin
        .from("users")
        .insert({
          id: userId,
          email,
          name,
          status: "active",
        });

      if (userError) {
        throw new Error(`Users insertion: ${userError.message}`);
      }

      // 6. Insert public.client
      const { error: clientError } = await supabaseAdmin
        .from("client")
        .insert({
          id: userId,
          contact: contact ?? null,
          details: details ?? null,
          photo: photoUrl,
          start_date: start_date ?? new Date().toISOString().split("T")[0],
        });

      if (clientError) {
        throw new Error(`Client insertion: ${clientError.message}`);
      }

      // 7. Assign client role
      const { error: insertRoleError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: userId,
          role_id: "client",
        });

      if (insertRoleError) {
        throw new Error(`Role insertion: ${insertRoleError.message}`);
      }

      // 8. Success
      return {
        success: true,
        message: "Client created successfully.",
        user: {
          id: userId,
          email,
          name,
          contact,
          details,
          photo: photoUrl,
          role: "client",
          status: "active",
        },
      };

    } catch (err: any) {
      console.error("Admin client creation error:", err);

      if (photoPath) {
        await supabaseAdmin.storage
          .from("avatars")
          .remove([photoPath]);
      }

      if (userId) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      }

      set.status = 400;

      return {
        success: false,
        message: err.message || "Client creation failed.",
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