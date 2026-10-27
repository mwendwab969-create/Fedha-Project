
<?php
require __DIR__ . '/db.php';

requirePost();
requireCsrf();

$data = readJson();

$name = trim($data['name'] ?? '');
$email = strtolower(trim($data['email'] ?? ''));
$pass = $data['password'] ?? '';

if (
    $name === '' ||
    strlen($name) > 100 ||
    !filter_var($email, FILTER_VALIDATE_EMAIL) ||
    strlen($email) > 190 ||
    !is_string($pass) ||
    strlen($pass) < 12 ||
    strlen($pass) > 72
) {
    respond([
        'error' => 'Enter a valid name and email. Password must be 12–72 characters.'
    ], 422);
}

try {
    $stmt = $pdo->prepare(
        'INSERT INTO users (name, email, password_hash)
         VALUES (:name, :email, :hash)'
    );

    $stmt->execute([
        'name' => $name,
        'email' => $email,
        'hash' => password_hash($pass, PASSWORD_DEFAULT)
    ]);

    respond(['message' => 'Account created. You can now log in.'], 201);

} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        respond(['error' => 'Unable to register with those details.'], 409);
    }

    error_log($e->getMessage());
    respond(['error' => 'Registration failed.'], 500);
}
