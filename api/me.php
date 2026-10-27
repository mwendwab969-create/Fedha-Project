
<?php
require __DIR__ . '/db.php';

if (empty($_SESSION['user_id'])) {
    respond(['error' => 'Please log in.'], 401);
}

respond([
    'user' => [
        'id' => (int) $_SESSION['user_id'],
        'name' => $_SESSION['user_name']
    ]
]);
