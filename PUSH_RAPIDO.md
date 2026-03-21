# 🚀 PUSH RÁPIDO PARA GITHUB

## ✅ Repositório Criado
- **URL**: https://github.com/rsetbrasil/adc-moveis-eletro
- **Status**: Pronto para receber código

## 📝 Opção 1: Script Automatizado (RECOMENDADO)

Abra o PowerShell e execute:

```powershell
cd "c:\Users\Rafael\Desktop\ADC MOVEIS ELETRO (VPS)"
.\push-github.ps1
```

## 📝 Opção 2: Comandos Manuais

Se preferir executar manualmente:

```powershell
cd "c:\Users\Rafael\Desktop\ADC MOVEIS ELETRO (VPS)"

# Adicionar todos os arquivos
git add .

# Criar commit
git commit -m "Initial commit: Sistema ADC Móveis e Eletros completo"

# Configurar remote
git remote remove origin
git remote add origin https://github.com/rsetbrasil/adc-moveis-eletro.git

# Fazer push
git push -u origin main
```

## 🔑 Autenticação

Quando pedir **senha**, use um **Personal Access Token**:

1. Acesse: https://github.com/settings/tokens
2. Clique em "Generate new token (classic)"
3. Marque o escopo `repo`
4. Copie o token
5. Cole quando o Git pedir senha

## ⚠️ Se o Git não estiver instalado

```powershell
# Baixe e instale
https://git-scm.com/download/win

# Depois reinicie o PowerShell
```

## ✅ Verificar Sucesso

Após o push, acesse:
https://github.com/rsetbrasil/adc-moveis-eletro

Você deve ver todos os arquivos do projeto!

## 🆘 Problemas?

### Erro: "git is not recognized"
→ Instale o Git e reinicie o PowerShell

### Erro: "Authentication failed"
→ Use Personal Access Token, não senha

### Erro: "remote origin already exists"
→ Execute: `git remote remove origin`
