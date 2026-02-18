# 📜 Registro de Propiedad Intelectual — FIDEITEC.COM

Esta carpeta contiene toda la documentación necesaria para el registro del software **FIDEITEC.COM** ante la **Dirección Nacional del Derecho de Autor (DNDA)** de Argentina.

---

## 📁 Contenido

| Archivo | Descripción |
|---------|-------------|
| `REGISTRO_DNDA_FIDEITEC_COM_v1.00.md` | Documento principal: carátula, memoria descriptiva, declaración de autoría, índice de extractos |
| `fideitec-com_extractos_v1.00.zip` | ZIP con los extractos representativos del código fuente (para depósito) |
| `HUELLA_INTEGRIDAD_v1.00.txt` | Hash SHA-256 del ZIP para verificación de integridad |
| `generar-zip-extractos.sh` | Script para regenerar el ZIP (útil para futuras versiones) |
| `README.md` | Este archivo |

---

## 📋 Datos del Registro

| Campo | Valor |
|-------|-------|
| **Software** | FIDEITEC.COM |
| **Versión** | 1.00 |
| **Titular** | Pablo Martin Faranna |
| **CUIT** | 20-27283949-3 |
| **Domicilio** | Parral 61 Piso 3ro Of. 8, CABA, Argentina |
| **Fecha de firma** | 16 de enero de 2026 |
| **Primer commit** | 2026-01-02 20:31:16 (UTC-03:00) |

---

## 🔐 Huella de Integridad

```
Archivo: fideitec-com_extractos_v1.00.zip
SHA-256: cfd1c4c0e56773acbea7ea1f50913b70afc4ccc5add674c2c4b17a2b2ec91f75
```

Para verificar:
```bash
shasum -a 256 fideitec-com_extractos_v1.00.zip
```

---

## ✅ Checklist para presentar en DNDA

- [x] Documento de registro (`REGISTRO_DNDA_FIDEITEC_COM_v1.00.md`)
- [x] ZIP con extractos del código (`fideitec-com_extractos_v1.00.zip`)
- [x] Huella de integridad SHA-256 (`HUELLA_INTEGRIDAD_v1.00.txt`)
- [ ] Comprobante de pago DNDA-CESSI
- [ ] Comprobante de pago Fondo Nacional de las Artes
- [ ] Firmar declaración de autoría (imprimir y firmar)

---

## 📖 Marco Legal

- **Ley 11.723**: Propiedad Intelectual
- **Decreto 165/1994**: Protección del software
- **Ley 24.441**: Fideicomisos (marco operativo del software)

---

## 🔄 Regenerar ZIP para futuras versiones

Si necesitás generar un nuevo ZIP (por ejemplo, para una versión actualizada):

```bash
# Editar VERSION en el script si es necesario
./generar-zip-extractos.sh
```

El script:
1. Copia los archivos relevantes (sin `.env`, sin `node_modules`)
2. Genera el ZIP
3. Calcula el SHA-256
4. Actualiza el archivo de huella

---

*Última actualización: 16 de enero de 2026*
