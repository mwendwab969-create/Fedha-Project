
<?php
require __DIR__ . '/db.php';

requirePost();
requireCsrf();

$data = readJson();
$email = strtolower(trim($data['email'] ?? ''));
$pass = $data['password'] ?? '';

if (
    !is_string($email) ||
    !filter_var($email, FILTER_VALIDATE_EMAIL) ||
    !is_string($pass) ||
    $pass === '' ||
    strlen($pass) > 72
) {
    respond(['error' => 'Invalid email or password.'], 401);
}

$stmt = $pdo->prepare(
    'SELECT id, name, email, password_hash
     FROM users
     WHERE email = :email
     LIMIT 1'
);

$stmt->execute(['email' => $email]);
$user = $stmt->fetch();

if (!$user || !password_verify($pass, $user['password_hash'])) {
    respond(['error' => 'Invalid email or password.'], 401);
}

session_regenerate_id(true);

$_SESSION['user_id'] = (int) $user['id'];
$_SESSION['user_name'] = $user['name'];

// Rotate the CSRF token after authentication.
$_SESSION['csrf_token'] = bin2hex(random_bytes(32));

respond([
    'message' => 'Login successful.',
    'user' => [
        'id' => (int) $user['id'],
        'name' => $user['name'],
        'email' => $user['email']
    ],
    'csrfToken' => $_SESSION['csrf_token']
]);
