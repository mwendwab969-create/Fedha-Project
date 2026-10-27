
<?php
require __DIR__ . '/db.php';

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

respond(['csrfToken' => $_SESSION['csrf_token']]);
