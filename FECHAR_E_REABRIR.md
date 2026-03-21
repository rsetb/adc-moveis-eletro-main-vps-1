# ⚠️ ATENÇÃO: Você AINDA está no PowerShell ANTIGO!

## 🔴 O Problema

Você instalou o Git, mas está tentando usar no **MESMO PowerShell que estava aberto ANTES** de instalar.

O PowerShell não vai "perceber" que o Git foi instalado até você **FECHAR COMPLETAMENTE** e abrir um novo.

## ✅ SOLUÇÃO (Siga EXATAMENTE):

### 1. FECHAR o VS Code COMPLETAMENTE
- Clique no ❌ para fechar o VS Code
- Ou pressione `Alt + F4`
- **FECHE TUDO**

### 2. ABRIR um NOVO VS Code
- Abra o VS Code novamente
- Ele vai abrir um novo terminal PowerShell

### 3. TESTAR se o Git funciona agora

No novo terminal, digite:

```powershell
git --version
```

**Deve aparecer**: `git version 2.XX.X`

Se aparecer isso → ✅ **FUNCIONOU!**

### 4. ENTÃO executar os comandos

```powershell
cd "c:\Users\Rafael\Desktop\ADC MOVEIS ELETRO (VPS)"

git config --global user.name "rsetbrasil"
git config --global user.email "rsetbrasil@gmail.com"

git add .
git commit -m "Initial commit: Sistema ADC Móveis e Eletros completo"
git remote remove origin
git remote add origin https://github.com/rsetbrasil/adc-moveis-eletro.git
git push -u origin main
```

---

## 🎯 RESUMO SIMPLES:

1. ❌ **FECHE** o VS Code
2. ✅ **ABRA** o VS Code novamente
3. ✅ **TESTE**: `git --version`
4. ✅ **EXECUTE** os comandos acima

**NÃO tente executar comandos Git no terminal atual! Ele não vai funcionar!**

---

## 🔑 Lembre-se:

Quando pedir senha no `git push`, use o **Personal Access Token**:
- https://github.com/settings/tokens
- Marque: ✅ `repo`
