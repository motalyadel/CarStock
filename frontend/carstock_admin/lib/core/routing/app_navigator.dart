
import 'package:flutter/material.dart';

class AppNavigator {
  AppNavigator._();

  static final GlobalKey<NavigatorState> globalKey =
      GlobalKey<NavigatorState>();

  static BuildContext get context =>
      globalKey.currentState!.context;

  static Future<T?> push<T>(String url) {
    return globalKey.currentState!.pushReplacementNamed<T, dynamic>(url);
  }

  static Future<T?> pushReplacement<T>(String url) {
    return globalKey.currentState!.pushReplacementNamed<T, dynamic>(url);
  }

  static Future<T?> pushNamed<T>(String url) {
    return globalKey.currentState!.pushNamed<T>(url);
  }

  static void pop<T>([T? result]) {
    globalKey.currentState?.pop<T>(result);
  }
}
