<?php
require __DIR__ . '/db.php';

if (empty($_SESSION['user_id'])) {
    respond(['error' => 'Please log in.'], 401);
}

$userId = (int) $_SESSION['user_id'];

$summaryStmt = $pdo->prepare(
    'SELECT
        (SELECT COALESCE(SUM(saved_amount), 0) FROM savings WHERE user_id = :savings_user) AS totalSavings,
        (SELECT COALESCE(SUM(target_amount), 0) FROM savings WHERE user_id = :targets_user) AS savingsTarget,
        (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE user_id = :expenses_user) AS totalExpenses,
        (SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE user_id = :withdrawals_user) AS totalWithdrawals'
);
$summaryStmt->execute([
    'savings_user' => $userId,
    'targets_user' => $userId,
    'expenses_user' => $userId,
    'withdrawals_user' => $userId
]);
$summary = $summaryStmt->fetch();

$transactionsStmt = $pdo->prepare(
    "SELECT description, type, amount, DATE_FORMAT(sort_date, '%Y-%m-%d') AS date
     FROM (
        SELECT id, description, 'Expense' AS type, amount, spent_on AS sort_date
        FROM expenses
        WHERE user_id = :expense_user
        UNION ALL
        SELECT id, description, 'Withdrawal' AS type, amount, withdrawn_at AS sort_date
        FROM withdrawals
        WHERE user_id = :withdrawal_user
     ) AS transactions
     ORDER BY sort_date DESC, id DESC
     LIMIT 10"
);
$transactionsStmt->execute([
    'expense_user' => $userId,
    'withdrawal_user' => $userId
]);

respond([
    'summary' => $summary,
    'recentTransactions' => $transactionsStmt->fetchAll()
]);
