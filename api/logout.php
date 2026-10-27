
<?php
require __DIR__ . '/db.php';

requirePost();
requireCsrf();

$_SESSION = [];

if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();

    setcookie(session_name(), '', [
        'expires' => time() - 42000,
        'path' => $params['path'],
        'secure' => $params['secure'],
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
}

session_destroy();

respond(['message' => 'Logged out successfully.']);
