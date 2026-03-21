<?php
// Script de depuração para verificar pedidos no banco de dados MySQL
$host = 'localhost';
$user = 'appuser';
$pass = 'H8$k@b.%!c'; // Senha fornecida pelo usuário
$db   = 'adc_pro_2026';

$mysqli = new mysqli($host, $user, $pass, $db);

if ($mysqli->connect_error) {
    die("Falha na conexão: " . $mysqli->connect_error);
}

echo "--- BUSCA POR PEDIDO ESPECÍFICO PED-386382 ---\n";
$res = $mysqli->query("SELECT * FROM orders WHERE id = 'PED-386382'");
if ($res && $res->num_rows > 0) {
    print_r($res->fetch_assoc());
} else {
    echo "Pedido PED-386382 não encontrado.\n";
}

echo "\n--- ÚLTIMOS 10 PEDIDOS ---\n";
$res = $mysqli->query("SELECT id, date, status, sellerId, source FROM orders ORDER BY createdAt DESC LIMIT 10");
while ($row = $res->fetch_assoc()) {
    echo "ID: " . $row['id'] . " | Data: " . $row['date'] . " | Status: " . $row['status'] . " | Seller: " . $row['sellerId'] . " | Source: " . $row['source'] . "\n";
}

$mysqli->close();
?>
