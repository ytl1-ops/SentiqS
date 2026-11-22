@echo off
rem SentiqS : collecte depuis ce PC, si GitHub Actions ne tourne plus.
rem Double-cliquez sur ce fichier. Voir docs\sans-serveur.md.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0collecte-locale.ps1"
