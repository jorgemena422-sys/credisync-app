# Recuperacion de clave con Supabase Auth

CrediSync ahora usa el flujo nativo de recuperacion de Supabase Auth para "Olvide mi clave".

## Requisitos

- `SUPABASE_URL` configurada en el backend
- `SUPABASE_ANON_KEY` configurada en el backend
- En Supabase Auth > URL Configuration:
  - `Site URL`: dominio publico donde vive la app
  - `Redirect URLs`: incluir `https://tu-dominio/reset-password-new`

## Separacion por entorno

- Produccion debe apuntar a su propio dominio y a su propio proyecto Supabase.
- Staging debe apuntar a `https://credisync-727b6-staging.web.app/reset-password-new` o a su dominio de pruebas equivalente.
- No reutilices la misma `Redirect URL` entre prod y staging si cada entorno usa un Supabase distinto.

## Flujo

1. El usuario solicita recuperacion en `ResetPassword.jsx`.
2. El frontend llama `supabase.auth.resetPasswordForEmail(...)`.
3. Supabase envia el email nativo de recovery.
4. El usuario abre el enlace recibido.
5. `ResetPasswordNew.jsx` crea la sesion temporal de recovery y permite cambiar la contrasena.

## Endpoint agregado

- `GET /api/auth/supabase-client-config`

Este endpoint expone solo `SUPABASE_URL` y `SUPABASE_ANON_KEY` para que el frontend pueda iniciar el flujo nativo de Auth.

## Nota de despliegue

Si el enlace abre bien pero no deja cambiar la contrasena, revisa primero las `Redirect URLs` en Supabase Auth.
