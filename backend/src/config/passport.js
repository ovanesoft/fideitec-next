const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const bcrypt = require('bcryptjs');
const { query } = require('./database');

// Serialización de usuario
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await query(
      'SELECT id, email, first_name, last_name, role, tenant_id, is_active FROM users WHERE id = $1',
      [id]
    );
    done(null, result.rows[0] || null);
  } catch (error) {
    done(error, null);
  }
});

// Estrategia Local (email + password)
passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password'
  },
  async (email, password, done) => {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      
      const result = await query(
        `SELECT u.*, t.name as tenant_name, t.is_active as tenant_active
         FROM users u
         LEFT JOIN tenants t ON u.tenant_id = t.id
         WHERE LOWER(u.email) = $1`,
        [normalizedEmail]
      );

      const user = result.rows[0];

      if (!user) {
        return done(null, false, { message: 'Credenciales inválidas' });
      }

      if (!user.is_active) {
        return done(null, false, { message: 'Cuenta desactivada' });
      }

      if (!user.email_verified) {
        return done(null, false, { message: 'Email no verificado' });
      }

      // Verificar contraseña
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!isValidPassword) {
        // Incrementar intentos fallidos
        await query(
          'UPDATE users SET failed_login_attempts = failed_login_attempts + 1, last_failed_login = NOW() WHERE id = $1',
          [user.id]
        );

        // Bloquear cuenta después de 5 intentos
        if (user.failed_login_attempts >= 4) {
          await query(
            'UPDATE users SET is_locked = true, locked_until = NOW() + INTERVAL \'30 minutes\' WHERE id = $1',
            [user.id]
          );
          return done(null, false, { message: 'Cuenta bloqueada por múltiples intentos fallidos' });
        }

        return done(null, false, { message: 'Credenciales inválidas' });
      }

      // Verificar si la cuenta está bloqueada
      if (user.is_locked && user.locked_until > new Date()) {
        return done(null, false, { message: 'Cuenta temporalmente bloqueada' });
      }

      // Resetear intentos fallidos y actualizar último login
      await query(
        `UPDATE users SET 
          failed_login_attempts = 0, 
          is_locked = false, 
          locked_until = NULL,
          last_login = NOW()
         WHERE id = $1`,
        [user.id]
      );

      // No enviar el hash de contraseña
      delete user.password_hash;
      return done(null, user);

    } catch (error) {
      return done(error);
    }
  }
));

// Estrategia Google OAuth
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  // Sanitizar variables para evitar espacios invisibles
  const clientID = process.env.GOOGLE_CLIENT_ID.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET.trim();
  const callbackURL = process.env.GOOGLE_CALLBACK_URL.trim();

  console.log('✅ Google OAuth configurado');
  console.log('   Callback URL:', callbackURL);
  
  passport.use(new GoogleStrategy(
    {
      clientID,
      clientSecret,
      callbackURL,
      proxy: true,
      accessType: 'offline', // Asegura obtener refresh token si es necesario
      prompt: 'consent'
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('Google OAuth - profile received:', profile.emails?.[0]?.value);
        const email = profile.emails[0].value.toLowerCase();
        
        // Buscar usuario existente
        let result = await query(
          'SELECT * FROM users WHERE LOWER(email) = $1 OR google_id = $2',
          [email, profile.id]
        );

        let user = result.rows[0];
        console.log('Google OAuth - existing user:', user ? user.id : 'none');

        if (user) {
          console.log('Google OAuth - user found:', user.id);
          // Actualizar google_id si no lo tiene
          if (!user.google_id) {
            console.log('Google OAuth - linking google_id');
            await query(
              'UPDATE users SET google_id = $1, email_verified = true WHERE id = $2',
              [profile.id, user.id]
            );
            user.google_id = profile.id;
            user.email_verified = true;
          }
          
          return done(null, user);
        }

        // Crear nuevo usuario
        console.log('Google OAuth - creating user');
        const insertResult = await query(
          `INSERT INTO users (
            email, first_name, last_name, google_id, 
            auth_provider, email_verified, is_active, role, login_count
          ) VALUES ($1, $2, $3, $4, 'google', true, true, 'user', 0)
          RETURNING id, email, first_name, last_name, role, tenant_id, is_active`,
          [email, profile.name?.givenName || 'Usuario', profile.name?.familyName || '', profile.id]
        );

        if (!insertResult.rows[0]) {
          throw new Error('No se pudo crear el usuario en la base de datos');
        }

        console.log('Google OAuth - user created:', insertResult.rows[0].id);
        return done(null, insertResult.rows[0]);

      } catch (error) {
        console.error('Google OAuth error:', error.message);
        return done(error);
      }
    }
  ));
} else {
  console.log('⚠️ Google OAuth NO configurado - faltan credenciales');
}

// Estrategia Facebook OAuth - Deshabilitada para FIDEITEC
// Si se necesita en el futuro, descomentar y configurar las credenciales
/*
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL,
      profileFields: ['id', 'emails', 'name']
    },
    async (accessToken, refreshToken, profile, done) => {
      // ... código de Facebook OAuth
    }
  ));
}
*/

module.exports = passport;

