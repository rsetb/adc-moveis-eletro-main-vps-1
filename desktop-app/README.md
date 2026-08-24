# ADC ERP Desktop

App Windows (Electron) que abre o sistema já rodando em produção (`adcmoveiseletro.com.br`) numa janela própria, com ícone no Menu Iniciar/Desktop e sessão de login persistente. Não é uma versão offline — continua usando a mesma internet e o mesmo banco de dados de sempre, só muda a forma de abrir.

## Rebuildar depois de uma mudança

```bash
cd desktop-app
npm install
npm run dist
```

O instalador sai em `desktop-app/dist/ADC ERP Setup <versão>.exe`.

## Notas

- O instalador não é assinado digitalmente, então o Windows SmartScreen pode avisar "Editor desconhecido" na primeira instalação — é só clicar em "Mais informações" → "Executar assim mesmo".
- Links do WhatsApp abrem no navegador padrão do Windows; links internos (carnê, etc.) abrem dentro do próprio app, usando a mesma sessão de login.
- Pra trocar a URL que o app abre, edite `APP_URL`/`APP_ORIGIN` no topo do `main.js`.
