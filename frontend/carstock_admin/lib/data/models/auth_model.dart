
abstract class AuthModel {
  final String id;
  final String? email;
  final String? name;
  final String? status;
  final List<AppRole> roles;

  AuthModel({
    required this.id,
    this.email,
    this.name,
    this.status,
    required this.roles,
  });

  AppRole? get currentRole => roles.isEmpty ? null : roles.first;

  bool get isAdmin => currentRole?.id == 'admin';
  bool get isClient => currentRole?.id == 'client';

  Map<String, dynamic> toMap();

  AuthModel copyWith();

  static String get usersTableName => 'users';
}

// ========================================
// STATUS
// ========================================

enum Status {
  active('Active'),
  inactive('Inactive');

  final String value;

  const Status(this.value);

  static Status fromString(String? value) {
    return Status.values.firstWhere(
      (status) => status.value.toLowerCase() == value?.toLowerCase(),
      orElse: () => Status.active,
    );
  }
}

// ========================================
// APP ROLE
// ========================================

class AppRole {
  final String id;

  AppRole({required this.id});

  factory AppRole.fromMap(Map<String, dynamic> map) {
    return AppRole(
      id: (map['id'] ?? map['role_id']).toString(),
    );
  }
}

// ========================================
// CLIENT
// ========================================

class Client extends AuthModel {
  final String? contact;
  final String? details;
  final String? photo;
  final DateTime? startDate;

  Client({
    required super.id,
    required super.roles,
    super.email,
    super.name,
    super.status,
    this.contact,
    this.details,
    this.photo,
    this.startDate,
  });

  static String get tableName => 'client';

  factory Client.fromMap(Map<String, dynamic> map) {
    final rawRoles = map['roles'] as List? ?? [];

    final roles = rawRoles.map((item) {
      final roleMap = Map<String, dynamic>.from(item as Map);
      final appRole = roleMap['app_role'];

      if (appRole is Map) {
        return AppRole.fromMap(Map<String, dynamic>.from(appRole));
      }

      return AppRole.fromMap(roleMap);
    }).toList();

    final rawClient = map['client'];

    final clientData = rawClient is Map
        ? Map<String, dynamic>.from(rawClient)
        : <String, dynamic>{};

    return Client(
      id: map['id'].toString(),
      email: map['email'] as String?,
      name: map['name'] as String?,
      status: map['status']?.toString() ?? Status.active.value,
      contact: clientData['contact'] as String?,
      details: clientData['details'] as String?,
      photo: clientData['photo'] as String?,
      startDate: clientData['start_date'] != null
          ? DateTime.tryParse(clientData['start_date'].toString())
          : null,
      roles: roles.isNotEmpty
          ? roles
          : [AppRole(id: 'client')],
    );
  }

  @override
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'status': status,
      'contact': contact,
      'details': details,
      'photo': photo,
      'start_date': startDate?.toIso8601String(),
    };
  }

  @override
  Client copyWith({
    String? email,
    String? name,
    String? status,
    String? contact,
    String? details,
    String? photo,
    DateTime? startDate,
  }) {
    return Client(
      id: id,
      roles: roles,
      email: email ?? this.email,
      name: name ?? this.name,
      status: status ?? this.status,
      contact: contact ?? this.contact,
      details: details ?? this.details,
      photo: photo ?? this.photo,
      startDate: startDate ?? this.startDate,
    );
  }
}

// ========================================
// ADMIN
// ========================================

class Admin extends AuthModel {
  Admin({
    required super.id,
    required super.roles,
    super.email,
    super.name,
    super.status,
  });

  static String get tableName => 'admin';

  factory Admin.fromMap(Map<String, dynamic> map) {
    final rawRoles = map['roles'] as List? ?? [];

    final roles = rawRoles.map((item) {
      final roleMap = Map<String, dynamic>.from(item as Map);
      final appRole = roleMap['app_role'];

      if (appRole is Map) {
        return AppRole.fromMap(Map<String, dynamic>.from(appRole));
      }

      return AppRole.fromMap(roleMap);
    }).toList();

    return Admin(
      id: map['id'].toString(),
      email: map['email'] as String?,
      name: map['name'] as String?,
      status: map['status']?.toString(),
      roles: roles.isNotEmpty
          ? roles
          : [AppRole(id: 'admin')],
    );
  }

  @override
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'status': status,
    };
  }

  @override
  Admin copyWith({
    String? email,
    String? name,
    String? status,
  }) {
    return Admin(
      id: id,
      roles: roles,
      email: email ?? this.email,
      name: name ?? this.name,
      status: status ?? this.status,
    );
  }
}
