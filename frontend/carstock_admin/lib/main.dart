
import 'package:carstock_admin/features/admin/home/admin_home_page.dart';
import 'package:carstock_admin/features/auth/splash/splash_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/theme/app_theme.dart';
import 'core/routing/app_navigator.dart';

import 'providers/auth_provider.dart';
import 'providers/car_provider.dart';
import 'providers/customer_provider.dart';
import 'providers/followup_provider.dart';

import 'features/auth/login/login_page.dart';
import 'features/auth/register/register_page.dart';
import 'features/admin/dashboard/dashboard_page.dart';
import 'features/client/home/client_home_page.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await dotenv.load(fileName: 'assets/.env');

  await Supabase.initialize(
    url: dotenv.env['SUPABASE_URL']!,
    publishableKey: dotenv.env['SUPABASE_ANON_KEY']!,
  );

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => CarProvider()),
        ChangeNotifierProvider(create: (_) => CustomerProvider()),
        ChangeNotifierProvider(create: (_) => FollowUpProvider()),
      ],
      child: const CarStockApp(),
    ),
  );
}

class CarStockApp extends StatelessWidget {
  const CarStockApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CarStock',
      debugShowCheckedModeBanner: false,

      theme: AppTheme.lightTheme,

      navigatorKey: AppNavigator.globalKey,

      initialRoute: '/login',

      routes: {
        '/': (_) => const SplashScreen(),
        '/login': (context) => const LoginPage(),
        '/signup': (context) => const RegisterPage(),
        '/admin_home': (context) => const AdminHomePage(),
        '/client_home': (context) => const ClientHomePage(),
        '/admin_dashboard_': (context) => const DashboardPage(),
      },
    );
  }
}
