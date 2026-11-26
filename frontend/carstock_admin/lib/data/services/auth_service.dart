
import 'package:carstock_admin/core/network/api_fetcher.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/auth_model.dart';

class AuthService {
  final SupabaseClient client;
  final ApiFetcher apiFetcher;

  AuthService({
    required this.apiFetcher,
    SupabaseClient? supabaseClient,
  }) : client = supabaseClient ?? Supabase.instance.client;

  // ========================================
  // CAR-13 / CAR-15
  // ADMIN LOGIN & CLIENT LOGIN
  // ========================================

  Future<AuthModel> _login({
    required String email,
    required String password,
    required String expectedRole,
  }) async {
    try {
      final authResponse = await client.auth.signInWithPassword(
        email: email.trim(),
        password: password,
      );

      final user = authResponse.user;

      if (user == null) {
        throw Exception('Unable to authenticate user.');
      }

      final profile = await _getUserProfile(user.id);

      if (profile == null) {
        await client.auth.signOut();
        throw Exception('User profile not found.');
      }

      final role = profile.currentRole?.id;

      if (role != expectedRole) {
        await client.auth.signOut();

        throw Exception(
          'Access denied. This account is not $expectedRole.',
        );
      }

      if (profile.status?.toLowerCase() == 'inactive') {
        await client.auth.signOut();
        throw Exception('This account is inactive.');
      }

      return profile;
    } on AuthException {
      rethrow;
    } catch (e) {
      rethrow;
    }
  }

  // CAR-13: Admin Login

  Future<Admin> loginAdmin({
    required String email,
    required String password,
  }) async {
    final user = await _login(
      email: email,
      password: password,
      expectedRole: 'admin',
    );

    return user as Admin;
  }

  // CAR-15: Client Login

  Future<Client> loginClient({
    required String email,
    required String password,
  }) async {
    final user = await _login(
      email: email,
      password: password,
      expectedRole: 'client',
    );

    return user as Client;
  }

  // ========================================
  // GET USER PROFILE
  // ========================================

  Future<AuthModel?> _getUserProfile(String userId) async {
    final response = await client
        .from('users')
        .select('''
          id,
          email,
          name,
          status,
          roles:user_roles(
            role_id,
            app_role(id)
          ),
          client(
            id,
            contact,
            details,
            photo,
            start_date
          ),
          admin(id)
        ''')
        .eq('id', userId)
        .maybeSingle();

    if (response == null) {
      return null;
    }

    final data = Map<String, dynamic>.from(response);

    final rawRoles = data['roles'] as List? ?? [];

    if (rawRoles.isEmpty) {
      return null;
    }

    final firstRole = rawRoles.first as Map;
    final appRole = firstRole['app_role'];

    final roleId = appRole is Map
        ? appRole['id']?.toString()
        : firstRole['role_id']?.toString();

    switch (roleId) {
      case 'admin':
        return Admin.fromMap(data);

      case 'client':
        return Client.fromMap(data);

      default:
        return null;
    }
  }

  // ========================================
  // CAR-14
  // CLIENT REGISTRATION
  // ========================================

  Future<bool> registerClient({
  required String name,
  required String email,
  required String password,
  String? contact,
}) async {
  final response = await apiFetcher.post(
    'api/v1/auth/register',
    body: {
      'name': name.trim(),
      'email': email.trim(),
      'password': password,
      'contact': contact?.trim(),
    },
  );

  if (!response.isSuccess) {
    throw Exception(response.error ?? 'Registration failed.');
  }

  final data = response.data;

  if (data is Map && data['success'] == true) {
    return true;
  }

  throw Exception(
    data is Map
        ? data['message']?.toString() ?? 'Registration failed.'
        : 'Invalid server response.',
  );
}
  // ========================================
  // CAR-16
  // LOGOUT
  // ========================================

  Future<void> logout() async {
    await client.auth.signOut();
  }

  // ========================================
  // CURRENT USER
  // ========================================

  Future<AuthModel?> getCurrentUser() async {
    final user = client.auth.currentUser;

    if (user == null) {
      return null;
    }

    return await _getUserProfile(user.id);
  }

  // ========================================
  // SESSION
  // ========================================

  bool get isLoggedIn => client.auth.currentSession != null;

  String? get accessToken =>
      client.auth.currentSession?.accessToken;
}
