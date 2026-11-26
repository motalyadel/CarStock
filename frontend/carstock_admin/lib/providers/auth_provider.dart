import 'package:carstock_admin/core/network/api_fetcher.dart';
import 'package:carstock_admin/core/routing/app_navigator.dart';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../data/models/auth_model.dart';
import '../data/services/auth_service.dart';

class AuthProvider extends ChangeNotifier {
  static AuthProvider? _instance;

  AuthProvider._();

  factory AuthProvider() {
    _instance ??= AuthProvider._();
    return _instance!;
  }

  final clientSpb = Supabase.instance.client;

  late final AuthService _service = AuthService(
    apiFetcher: ApiFetcher(
      baseUrl: 'http://localhost:3000',
    ),
  );

  AuthService get service => _service;

  AuthModel? _user;

  AuthModel? get user => _user;

  Client? get currentUser =>
      _user is Client ? _user as Client : null;

  Admin? get currentAdmin =>
      _user is Admin ? _user as Admin : null;

  String get currentRole => _user?.currentRole?.id ?? '';

  bool loading = true;
  String? error;

  // ========================================
  // REDIRECT
  // ========================================

  Future<void> redirect() async {
    try {
      final response = await clientSpb.auth.getUser();

      if (response.user == null) {
        return AppNavigator.pushReplacement('/login');
      }

      await getUserAndPushToHome();

      if (_user == null) {
        await signOut();
      }
    } catch (e) {
      return AppNavigator.pushReplacement('/login');
    }
  }

  // ========================================
  // GET USER AND REDIRECT TO HOME
  // ========================================

  Future<void> getUserAndPushToHome() async {
    await getUser();

    if (_user != null) {
      pushToHome();
    }
  }

  // ========================================
  // GET USER
  // ========================================

  Future<void> getUser() async {
    try {
      loading = true;
      error = null;
      notifyListeners();

      final response = await service.getCurrentUser();

      if (response == null) {
        throw Exception("User doesn't exist");
      }

      if (response.status?.toLowerCase() == 'inactive') {
        throw Exception('This account is inactive.');
      }

      _user = response;

      loading = false;
      notifyListeners();
    } catch (e) {
      _user = null;
      loading = false;
      error = e.toString();
      notifyListeners();
    }
  }

  // ========================================
  // NAVIGATION BY ROLE
  // ========================================

  void pushToHome() {
    switch (currentRole) {
      case 'admin':
        AppNavigator.pushReplacement('/admin_home');
        break;

      case 'client':
        AppNavigator.pushReplacement('/client_home');
        break;

      default:
        AppNavigator.pushReplacement('/login');
    }
  }

  // ========================================
  // ADMIN ACCESS
  // ========================================

  Future<bool> canAccessClientList() async {
    await getUser();

    return _user != null && currentRole == 'admin';
  }

  Future<void> tryAccessClientList() async {
    if (await canAccessClientList()) {
      AppNavigator.push('/manage_users');
    } else {
      AppNavigator.pushReplacement('/login');
    }
  }

  // ========================================
  // LOGOUT
  // ========================================

  Future<void> signOut() async {
    try {
      await service.logout();

      _user = null;
      error = null;

      AppNavigator.pushReplacement('/login');

      notifyListeners();
    } catch (e) {
      error = 'Logout failed: $e';
      notifyListeners();
    }
  }
}