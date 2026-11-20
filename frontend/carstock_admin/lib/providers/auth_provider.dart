
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class AuthProvider extends ChangeNotifier {
  final SupabaseClient _supabase = Supabase.instance.client;

  User? _user;
  String? _role;
  bool _isLoading = false;

  User? get user => _user;
  String? get role => _role;
  bool get isLoading => _isLoading;

  bool get isAuthenticated => _user != null;
  bool get isAdmin => _role == 'admin';
  bool get isClient => _role == 'client';

  AuthProvider() {
    _user = _supabase.auth.currentUser;

    _supabase.auth.onAuthStateChange.listen((data) {
      _user = data.session?.user;
      notifyListeners();
    });
  }

  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    try {
      await _supabase.auth.signOut();
      _user = null;
      _role = null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
