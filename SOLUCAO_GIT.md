# 🔴 PROBLEMA: Git Não Instalado

O erro aconteceu porque o **Git não está instalado** no seu Windows.

## ✅ SOLUÇÃO RÁPIDA

### 1️⃣ Instalar o Git (5 minutos)

**Baixe aqui**: https://git-scm.com/download/win

**Durante a instalação:**
- ✅ Marque: **"Git from the command line and also from 3rd-party software"**
- ✅ Mantenha outras opções padrão

### 2️⃣ Reiniciar PowerShell

**IMPORTANTE**: Após instalar:
1. Feche TODAS as janelas do PowerShell
2. Feche o VS Code
3. Abra novamente

### 3️⃣ Executar Comandos

Abra um NOVO PowerShell:

```powershell
# Testar se instalou
git --version

# Ir para a pasta
cd "c:\Users\Rafael\Desktop\ADC MOVEIS ELETRO (VPS)"

# Configurar Git (primeira vez)
git config --global user.name "rsetbrasil"
git config --global user.email "rsetbrasil@gmail.com"

# Publicar no GitHub
git add .
git commit -m "Initial commit: Sistema ADC Móveis e Eletros completo"
git remote remove origin
git remote add origin https://github.com/rsetbrasil/adc-moveis-eletro.git
git push -u origin main
```

### 4️⃣ Autenticação

Quando pedir **senha**, use um **Personal Access Token**:

1. Crie em: https://github.com/settings/tokens
2. Clique em "Generate new token (classic)"
3. Marque: ✅ `repo`
4. Copie o token (formato: `ghp_xxxxx...`)
5. Cole quando pedir senha

## 📋 Resumo

1. ⬇️ Baixar Git: https://git-scm.com/download/win
2. 💿 Instalar (marcar opção "command line")
3. 🔄 Reiniciar PowerShell
4. 🔑 Criar token: https://github.com/settings/tokens
5. 🚀 Executar comandos acima
6. ✅ Verificar: https://github.com/rsetbrasil/adc-moveis-eletro

---

**Documentação completa**: Veja o arquivo `solucao_git_nao_instalado.md` nos artifacts
