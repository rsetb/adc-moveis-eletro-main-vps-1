# 🚀 Guia Rápido - Publicar no GitHub

## Opção 1: Script Automatizado (Recomendado)

Execute o script PowerShell que criei:

```powershell
cd "c:\Users\Rafael\Desktop\ADC MOVEIS ELETRO (VPS)"
.\publish-to-github.ps1
```

O script vai te guiar por todo o processo!

## Opção 2: Comandos Manuais

### 1. ✅ Repositório já criado no GitHub
- URL: https://github.com/rsetbrasil/adc-moveis-eletro
- Nome: `adc-moveis-eletro`

### 2. Executar comandos

```powershell
cd "c:\Users\Rafael\Desktop\ADC MOVEIS ELETRO (VPS)"

# Adicionar arquivos
git add .

# Criar commit
git commit -m "Initial commit: Sistema ADC Móveis e Eletros completo"

# Remover remote antigo
git remote remove origin

# Adicionar novo remote
git remote add origin https://github.com/rsetbrasil/adc-moveis-eletro.git

# Fazer push
git push -u origin main
```

### 3. Autenticação
Quando pedir senha, use um **Personal Access Token**:
- Crie em: https://github.com/settings/tokens
- Marque o escopo `repo`
- Cole o token quando pedir senha

## ⚠️ Se o Git não estiver instalado

1. Baixe: https://git-scm.com/download/win
2. Instale com opções padrão
3. Reinicie o PowerShell
4. Execute novamente

## ✅ Verificação

Após o push, acesse:
```
https://github.com/rsetbrasil/adc-moveis-eletro
```

## 📚 Documentação Completa

Para mais detalhes, consulte: `guia_publicacao_github.md`
