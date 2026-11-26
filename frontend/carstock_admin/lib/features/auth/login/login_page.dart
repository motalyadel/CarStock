
import 'package:carstock_admin/core/routing/app_navigator.dart';
import 'package:carstock_admin/providers/auth_provider.dart';
import 'package:flutter/material.dart';

class AppColors {
  static const Color primary = Color(0xFF172B4D);
  static const Color primaryLight = Color(0xFF253F66);
  static const Color secondary = Color(0xFF00A884);
  static const Color accent = Color(0xFFFFA726);
  static const Color background = Color(0xFFF4F6FA);
  static const Color surface = Colors.white;
  static const Color textPrimary = Color(0xFF172B4D);
  static const Color textSecondary = Color(0xFF7A869A);
  static const Color error = Color(0xFFE53935);
}

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();

  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  String _selectedRole = 'client';

  bool _isLoading = false;
  bool _passwordVisible = false;

  String? _error;

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final service = AuthProvider().service;

      if (_selectedRole == 'admin') {
        await service.loginAdmin(
          email: _emailController.text.trim(),
          password: _passwordController.text,
        );
      } else {
        await service.loginClient(
          email: _emailController.text.trim(),
          password: _passwordController.text,
        );
      }

      if (!mounted) return;

      await AuthProvider().getUserAndPushToHome();
    } on Exception catch (e) {
      if (!mounted) return;

      final message = e.toString();

      setState(() {
        if (message.contains('Email not confirmed')) {
          _error =
              'Veuillez confirmer votre adresse e-mail avant de vous connecter.';
        } else if (message.contains('Invalid login credentials')) {
          _error = 'E-mail ou mot de passe incorrect.';
        } else if (message.contains('inactive')) {
          _error = 'Votre compte est désactivé.';
        } else if (message.contains('Access denied')) {
          _error = 'Ce compte ne possède pas le rôle sélectionné.';
        } else {
          _error = message.replaceFirst('Exception: ', '');
        }
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _error = 'Une erreur est survenue : $e';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isMobile = constraints.maxWidth < 600;

            return Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: isMobile ? 420 : 460,
                  ),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SizedBox(height: 20),

                        // LOGO
                        Container(
                          width: 85,
                          height: 85,
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            borderRadius: BorderRadius.circular(24),
                          ),
                          child: const Icon(
                            Icons.directions_car_rounded,
                            color: Colors.white,
                            size: 48,
                          ),
                        ),

                        const SizedBox(height: 24),

                        Text(
                          'Bienvenue sur CarStock',
                          textAlign: TextAlign.center,
                          style: theme.textTheme.headlineSmall?.copyWith(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),

                        const SizedBox(height: 8),

                        const Text(
                          'Connectez-vous pour accéder à votre espace.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 14,
                          ),
                        ),

                        const SizedBox(height: 32),

                        // ROLE SELECTION
                        const Text(
                          'Type de compte',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),

                        const SizedBox(height: 12),

                        Row(
                          children: [
                            Expanded(
                              child: _roleButton(
                                title: 'Client',
                                icon: Icons.person_outline,
                                value: 'client',
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: _roleButton(
                                title: 'Admin',
                                icon: Icons.admin_panel_settings_outlined,
                                value: 'admin',
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 24),

                        // EMAIL
                        TextFormField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          decoration: _inputDecoration(
                            label: 'Adresse e-mail',
                            icon: Icons.email_outlined,
                          ),
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Veuillez saisir votre e-mail.';
                            }

                            if (!RegExp(
                              r'^[^@\s]+@[^@\s]+\.[^@\s]+$',
                            ).hasMatch(value.trim())) {
                              return 'Adresse e-mail invalide.';
                            }

                            return null;
                          },
                        ),

                        const SizedBox(height: 18),

                        // PASSWORD
                        TextFormField(
                          controller: _passwordController,
                          obscureText: !_passwordVisible,
                          decoration: _inputDecoration(
                            label: 'Mot de passe',
                            icon: Icons.lock_outline,
                          ).copyWith(
                            suffixIcon: IconButton(
                              onPressed: () {
                                setState(() {
                                  _passwordVisible = !_passwordVisible;
                                });
                              },
                              icon: Icon(
                                _passwordVisible
                                    ? Icons.visibility_off_outlined
                                    : Icons.visibility_outlined,
                              ),
                            ),
                          ),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Veuillez saisir votre mot de passe.';
                            }

                            if (value.length < 6) {
                              return 'Mot de passe trop court.';
                            }

                            return null;
                          },
                        ),

                        if (_error != null) ...[
                          const SizedBox(height: 18),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.error.withOpacity(0.08),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              _error!,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: AppColors.error,
                              ),
                            ),
                          ),
                        ],

                        const SizedBox(height: 28),

                        // LOGIN BUTTON
                        SizedBox(
                          height: 54,
                          child: ElevatedButton(
                            onPressed: _isLoading ? null : _login,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: _isLoading
                                ? const SizedBox(
                                    width: 24,
                                    height: 24,
                                    child: CircularProgressIndicator(
                                      color: Colors.white,
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Text(
                                    'Se connecter',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                          ),
                        ),

                        const SizedBox(height: 16),

                        if (_selectedRole == 'client')
                          TextButton(
                            onPressed: () {
                              AppNavigator.pushReplacement('/signup');
                            },
                            child: const Text(
                              'Vous n’avez pas de compte ? Créer un compte',
                              style: TextStyle(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),

                        const SizedBox(height: 30),

                        const Text(
                          'CARSTOCK',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 3,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _roleButton({
    required String title,
    required IconData icon,
    required String value,
  }) {
    final selected = _selectedRole == value;

    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () {
        setState(() {
          _selectedRole = value;
          _error = null;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.primary.withOpacity(0.08)
              : Colors.white,
          border: Border.all(
            color: selected
                ? AppColors.primary
                : Colors.grey.shade300,
            width: selected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              color: selected
                  ? AppColors.primary
                  : AppColors.textSecondary,
              size: 28,
            ),
            const SizedBox(height: 8),
            Text(
              title,
              style: TextStyle(
                color: selected
                    ? AppColors.primary
                    : AppColors.textSecondary,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _inputDecoration({
    required String label,
    required IconData icon,
  }) {
    return InputDecoration(
      labelText: label,
      prefixIcon: Icon(icon, color: AppColors.textSecondary),
      filled: true,
      fillColor: AppColors.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.grey.shade300),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(
          color: AppColors.primary,
          width: 2,
        ),
      ),
    );
  }
}
