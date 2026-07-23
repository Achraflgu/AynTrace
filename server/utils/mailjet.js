// Mailjet email utility for sending verification codes
import Mailjet from 'node-mailjet';

// Mailjet configuration
const mailjetClient = Mailjet.apiConnect(
    '5d56417321ba91f9b5abc5c045006546', // API Key
    'a18f3ac5bb5a8e88ed7354b33f351cb7'  // Secret Key
);

const SENDER_EMAIL = 'achrafgu92@gmail.com';
const SENDER_NAME = 'AynTrace Platform';

/**
 * Generate a random 6-digit verification code
 * @returns {string} 6-digit code
 */
export function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send verification code email via Mailjet
 */
export async function sendVerificationEmail(recipientEmail, recipientName, code) {
    try {
        const result = await mailjetClient
            .post('send', { version: 'v3.1' })
            .request({
                Messages: [{
                    From: { Email: SENDER_EMAIL, Name: SENDER_NAME },
                    To: [{ Email: recipientEmail, Name: recipientName || recipientEmail }],
                    Subject: 'Vérification de votre email - AynTrace',
                    HTMLPart: `
                        <div style="background-color: #f1f5f9; padding: 40px 20px; width: 100%; box-sizing: border-box; font-family: 'Inter', Helvetica, Arial, sans-serif;">
                            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.08);">
                                <!-- Header -->
                                <div style="text-align: center; padding: 40px 20px; background-color: #0B1829; background-image: linear-gradient(135deg, #0B1829 0%, #11253E 100%);">
                                    <h1 style="margin: 0; font-size: 32px; font-weight: 900; letter-spacing: -1.5px; font-family: 'Inter', Helvetica, sans-serif;">
                                        <span style="color: #ffffff;">Ayn</span><span style="color: #039C51;">Trace</span>
                                    </h1>
                                    <p style="color: #94a3b8; margin-top: 8px; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">Plateforme de Géolocalisation Pro</p>
                                </div>
                                
                                <!-- Body -->
                                <div style="padding: 40px 30px; text-align: center;">
                                    <h2 style="color: #0B1829; margin-top: 0; font-size: 24px; font-weight: 700;">Validation de votre email</h2>
                                    <p style="color: #475569; line-height: 1.6; font-size: 16px; margin-bottom: 30px; margin-top: 20px;">
                                        Bonjour <strong style="color: #0B1829;">${recipientName || 'Utilisateur'}</strong>,<br><br>
                                        Merci de rejoindre AynTrace. Pour activer et sécuriser votre compte, veuillez utiliser le code d'accès ci-dessous :
                                    </p>
                                    
                                    <div style="background: rgba(3, 156, 81, 0.05); border: 2px dashed rgba(3, 156, 81, 0.3); color: #039C51; font-size: 38px; font-weight: 800; text-align: center; padding: 25px; border-radius: 12px; letter-spacing: 12px; margin: 35px auto; width: fit-content;">
                                        ${code}
                                    </div>
                                    
                                    <p style="color: #0284c7; font-size: 14px; margin-top: 30px; background: #f0f9ff; padding: 12px; border-radius: 8px; display: inline-block;">
                                        ⏳ Ce code expirera dans <strong>10 minutes</strong>
                                    </p>
                                </div>
                                
                                <!-- Footer -->
                                <div style="padding: 25px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                                    <p style="color: #64748b; font-size: 12px; line-height: 1.6; margin: 0;">
                                        Si vous n'avez pas demandé ce code, vous pouvez ignorer cet email.<br>
                                        © ${new Date().getFullYear()} AynTrace Technologies - Tous droits réservés.
                                    </p>
                                </div>
                            </div>
                        </div>
                    `
                }]
            });
        return result.body.Messages[0].Status === 'success';
    } catch (error) {
        console.error('Mailjet Verification Error:', error.message);
        return false;
    }
}

/**
 * Send password reset code email via Mailjet
 */
export async function sendPasswordResetEmail(recipientEmail, recipientName, code) {
    try {
        const result = await mailjetClient
            .post('send', { version: 'v3.1' })
            .request({
                Messages: [{
                    From: { Email: SENDER_EMAIL, Name: SENDER_NAME },
                    To: [{ Email: recipientEmail, Name: recipientName || recipientEmail }],
                    Subject: 'Réinitialisation de votre mot de passe - AynTrace',
                    HTMLPart: `
                        <div style="background-color: #f1f5f9; padding: 40px 20px; width: 100%; box-sizing: border-box; font-family: 'Inter', Helvetica, Arial, sans-serif;">
                            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.08);">
                                <!-- Header -->
                                <div style="text-align: center; padding: 40px 20px; background-color: #0B1829; background-image: linear-gradient(135deg, #0B1829 0%, #11253E 100%);">
                                    <h1 style="margin: 0; font-size: 32px; font-weight: 900; letter-spacing: -1.5px; font-family: 'Inter', Helvetica, sans-serif;">
                                        <span style="color: #ffffff;">Ayn</span><span style="color: #039C51;">Trace</span>
                                    </h1>
                                    <p style="color: #94a3b8; margin-top: 8px; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">Sécurité du compte</p>
                                </div>
                                
                                <!-- Body -->
                                <div style="padding: 40px 30px; text-align: center;">
                                    <h2 style="color: #0B1829; margin-top: 0; font-size: 24px; font-weight: 700;">Réinitialisation du mot de passe</h2>
                                    <p style="color: #475569; line-height: 1.6; font-size: 16px; margin-bottom: 30px; margin-top: 20px;">
                                        Bonjour <strong style="color: #0B1829;">${recipientName || 'Utilisateur'}</strong>,<br><br>
                                        Nous avons reçu une demande pour modifier votre mot de passe. Veuillez utiliser ce code de sécurité pour créer un nouveau mot de passe :
                                    </p>
                                    
                                    <div style="background: rgba(3, 156, 81, 0.05); border: 2px dashed rgba(3, 156, 81, 0.3); color: #039C51; font-size: 38px; font-weight: 800; text-align: center; padding: 25px; border-radius: 12px; letter-spacing: 12px; margin: 35px auto; width: fit-content;">
                                        ${code}
                                    </div>
                                    
                                    <p style="color: #b91c1c; font-size: 14px; margin-top: 30px; background: #fef2f2; padding: 12px; border-radius: 8px; display: inline-block;">
                                        ⏰ Ce code est à usage unique et expire dans <strong>10 minutes</strong>
                                    </p>
                                </div>
                                
                                <!-- Footer -->
                                <div style="padding: 25px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                                    <p style="color: #64748b; font-size: 12px; line-height: 1.6; margin: 0;">
                                        Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.<br>
                                        Votre mot de passe restera inchangé.<br><br>
                                        © ${new Date().getFullYear()} AynTrace Technologies - Tous droits réservés.
                                    </p>
                                </div>
                            </div>
                        </div>
                    `
                }]
            });
        console.log(`[📧 EMAIL] Verification code sent to ${recipientEmail}`);
        return true;
    } catch (error) {
        console.error('[📧 EMAIL ERROR]', error.message);
        return false;
    }
}

export async function sendStatusUpdateEmail(recipientEmail, recipientName, orderRef, newStatus) {
    let subject = '';
    let headline = '';
    let message = '';
    let icon = '';

    switch (newStatus) {
        case 'pending':
            subject = 'Demande de traceurs reçue - AynTrace';
            headline = 'Demande en attente';
            icon = '⏳';
            message = 'Nous avons bien reçu votre demande d\'abonnement pour nos traceurs GPS. Notre équipe traitera votre demande sous peu et nous vous contacterons par téléphone très prochainement pour confirmer les détails avec vous.';
            break;
        case 'confirmed':
            subject = 'Votre commande est confirmée ! - AynTrace';
            headline = 'Commande Confirmée';
            icon = '✅';
            message = 'Excellente nouvelle ! Votre commande de traceurs GPS a été validée par notre équipe. Nous préparons actuellement l\'étape d\'installation physique. Notre équipe technique vous contactera très prochainement.';
            break;
        case 'installing':
            subject = 'Installation de vos équipements en cours - AynTrace';
            headline = 'Installation en cours';
            icon = '🔧';
            message = 'Votre commande est maintenant à l\'étape d\'installation. Nos techniciens procèdent à la configuration et à la pose de vos appareils. Vous recevrez vos identifiants d\'accès dès que l\'activation finale sera complétée.';
            break;
        case 'cancelled':
            subject = 'Annulation de votre commande - AynTrace';
            headline = 'Commande Annulée';
            icon = '❌';
            message = 'Votre demande d\'abonnement a été annulée. Si vous pensez qu\'il s\'agit d\'une erreur ou si vous souhaitez obtenir plus de détails, n\'hésitez pas à nous contacter.';
            break;
        default:
            return false;
    }

    try {
        await mailjetClient
            .post('send', { version: 'v3.1' })
            .request({
                Messages: [{
                    From: { Email: SENDER_EMAIL, Name: SENDER_NAME },
                    To: [{ Email: recipientEmail, Name: recipientName || recipientEmail }],
                    Subject: subject,
                    HTMLPart: `
                        <div style="background-color: #f1f5f9; padding: 40px 20px; width: 100%; box-sizing: border-box; font-family: 'Inter', Helvetica, Arial, sans-serif;">
                            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.08);">
                                <!-- Header -->
                                <div style="text-align: center; padding: 40px 20px; background-color: #0B1829; background-image: linear-gradient(135deg, #0B1829 0%, #11253E 100%);">
                                    <h1 style="margin: 0; font-size: 32px; font-weight: 900; letter-spacing: -1.5px; font-family: 'Inter', Helvetica, sans-serif;">
                                        <span style="color: #ffffff;">Ayn</span><span style="color: #039C51;">Trace</span>
                                    </h1>
                                    <p style="color: #94a3b8; margin-top: 8px; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">Mise à jour de commande</p>
                                </div>
                                
                                <!-- Body -->
                                <div style="padding: 40px 30px; text-align: center;">
                                    <div style="font-size: 48px; margin-bottom: 15px;">${icon}</div>
                                    <h2 style="color: #0B1829; margin-top: 0; font-size: 24px; font-weight: 700;">${headline}</h2>
                                    <p style="color: #475569; font-size: 15px; margin: 0 0 20px 0;">Référence : <strong style="color: #039C51;">${orderRef}</strong></p>
                                    
                                    <div style="background: rgba(3, 156, 81, 0.05); border-left: 4px solid #039C51; padding: 20px; border-radius: 8px; margin-bottom: 30px; text-align: left;">
                                        <p style="color: #334155; line-height: 1.6; margin: 0; font-size: 15px;">
                                            Bonjour <strong style="color: #0B1829;">${recipientName || 'Client'}</strong>,<br><br>
                                            ${message}
                                        </p>
                                    </div>
                                </div>
                                
                                <!-- Footer -->
                                <div style="padding: 25px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                                    <p style="color: #64748b; font-size: 12px; line-height: 1.6; margin: 0;">
                                        Besoin d'aide ? Appelez-nous au <strong style="color: #0B1829;">+216 71 000 000</strong><br>
                                        © ${new Date().getFullYear()} AynTrace Technologies - Tous droits réservés.
                                    </p>
                                </div>
                            </div>
                        </div>
                    `
                }]
            });
        console.log(`[📧 EMAIL] Status update (${newStatus}) sent to ${recipientEmail}`);
        return true;
    } catch (error) {
        console.error('[📧 EMAIL ERROR]', error.message);
        return false;
    }
}

export async function sendUpgradeConfirmEmail(recipientEmail, recipientName, orderRef, deviceCount, plan) {
    const planLabel = { starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' }[plan] || plan;
    try {
        await mailjetClient
            .post('send', { version: 'v3.1' })
            .request({
                Messages: [{
                    From: { Email: SENDER_EMAIL, Name: SENDER_NAME },
                    To: [{ Email: recipientEmail, Name: recipientName || recipientEmail }],
                    Subject: `Commande d'extension reçue — AynTrace (${orderRef})`,
                    HTMLPart: `
                        <div style="background-color: #f1f5f9; padding: 40px 20px; width: 100%; box-sizing: border-box; font-family: 'Inter', Helvetica, Arial, sans-serif;">
                            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.08);">
                                <!-- Header -->
                                <div style="text-align: center; padding: 40px 20px; background-color: #0B1829; background-image: linear-gradient(135deg, #0B1829 0%, #11253E 100%);">
                                    <h1 style="margin: 0; font-size: 32px; font-weight: 900; letter-spacing: -1.5px; font-family: 'Inter', Helvetica, sans-serif;">
                                        <span style="color: #ffffff;">Ayn</span><span style="color: #039C51;">Trace</span>
                                    </h1>
                                    <p style="color: #94a3b8; margin-top: 8px; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">Extension de service</p>
                                </div>
                                
                                <!-- Body -->
                                <div style="padding: 40px 30px; text-align: center;">
                                    <div style="font-size: 48px; margin-bottom: 15px;">🎉</div>
                                    <h2 style="color: #0B1829; margin-top: 0; font-size: 24px; font-weight: 700;">Demande d'extension confirmée</h2>
                                    <p style="color: #475569; font-size: 15px; margin: 0 0 20px 0;">Référence : <strong style="color: #039C51;">${orderRef}</strong></p>
                                    
                                    <div style="background: rgba(3, 156, 81, 0.05); border: 1px solid rgba(3, 156, 81, 0.2); padding: 20px; border-radius: 8px; margin-bottom: 25px; text-align: left;">
                                        <p style="color: #334155; line-height: 1.6; margin: 0 0 15px 0; font-size: 15px;">
                                            Bonjour <strong style="color: #0B1829;">${recipientName || 'Client'}</strong>,<br><br>
                                            Merci de votre confiance ! Nous avons bien enregistré votre demande d'ajout de <strong>${deviceCount} appareils</strong> supplémentaires à votre flotte.
                                        </p>
                                    </div>

                                    <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:16px; margin-bottom:25px; text-align:left;">
                                        <p style="color:#1d4ed8; font-size:14px; margin:0; line-height:1.5;">
                                            <strong>💡 Bon à savoir :</strong> En tant que client AynTrace, vos nouveaux appareils
                                            seront directement associés à votre compte existant.
                                            Vous les retrouverez dans votre espace <em>Mes Appareils</em> dès l'activation.
                                        </p>
                                    </div>
                                </div>
                                
                                <!-- Footer -->
                                <div style="padding: 25px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                                    <p style="color: #64748b; font-size: 12px; line-height: 1.6; margin: 0;">
                                        Questions ? Appelez-nous au <strong style="color: #0B1829;">+216 71 000 000</strong><br>
                                        © ${new Date().getFullYear()} AynTrace Technologies - Tous droits réservés.
                                    </p>
                                </div>
                            </div>
                        </div>
                    `
                }]
            });
        console.log(`[📧 EMAIL] Upgrade order confirmation sent to ${recipientEmail} (${orderRef})`);
        return true;
    } catch (error) {
        console.error('[📧 EMAIL ERROR]', error.message);
        return false;
    }
}

export async function sendAlertEmail(recipientEmail, recipientName, alertType, alertMessage, deviceName) {
    let icon = '🔔';
    let color = '#f59e0b'; // warning (yellow)
    let alertTitle = 'Nouvelle Alerte';

    if (alertType === 'battery') { icon = '🔋'; color = '#f97316'; alertTitle = 'Alerte Batterie'; }
    else if (alertType === 'speed') { icon = '🏎️'; color = '#ef4444'; alertTitle = 'Excès de Vitesse'; }
    else if (alertType === 'signal') { icon = '📶'; color = '#eab308'; alertTitle = 'Signal Faible'; }
    else if (alertType === 'sos') { icon = '🆘'; color = '#dc2626'; alertTitle = 'Urgence SOS'; }
    else if (alertType === 'Aynfence') { icon = '📍'; color = '#10b981'; alertTitle = 'Alerte Zone Géographique'; }
    else if (alertType === 'offline') { icon = '🔌'; color = '#64748b'; alertTitle = 'Traceur Hors Ligne'; }

    try {
        await mailjetClient
            .post('send', { version: 'v3.1' })
            .request({
                Messages: [{
                    From: { Email: SENDER_EMAIL, Name: SENDER_NAME },
                    To: [{ Email: recipientEmail, Name: recipientName || recipientEmail }],
                    Subject: `${icon} ${alertTitle} - ${deviceName} | AynTrace`,
                    HTMLPart: `
                        <div style="background-color: #f1f5f9; padding: 40px 20px; width: 100%; box-sizing: border-box; font-family: 'Inter', Helvetica, Arial, sans-serif;">
                            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.08);">
                                <!-- Header -->
                                <div style="text-align: center; padding: 40px 20px; background-color: #0B1829; background-image: linear-gradient(135deg, #0B1829 0%, #11253E 100%);">
                                    <h1 style="margin: 0; font-size: 32px; font-weight: 900; letter-spacing: -1.5px; font-family: 'Inter', Helvetica, sans-serif;">
                                        <span style="color: #ffffff;">Ayn</span><span style="color: #039C51;">Trace</span>
                                    </h1>
                                    <p style="color: #94a3b8; margin-top: 8px; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">Détection d'anomalie</p>
                                </div>
                                
                                <!-- Body -->
                                <div style="padding: 40px 30px; text-align: center;">
                                    <div style="font-size: 48px; margin-bottom: 15px;">${icon}</div>
                                    <h2 style="color: ${color}; margin-top: 0; font-size: 24px; font-weight: 700;">${alertTitle}</h2>
                                    <p style="color: #475569; font-size: 15px; margin: 0 0 20px 0;">Traceur : <strong style="color: #0B1829;">${deviceName}</strong></p>
                                    
                                    <div style="background: #ffffff; border-left: 4px solid ${color}; padding: 20px; border-radius: 8px; margin-bottom: 30px; text-align: left; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                                        <p style="color: #334155; line-height: 1.6; margin: 0; font-size: 15px;">
                                            Bonjour <strong style="color: #0B1829;">${recipientName || 'Opérateur'}</strong>,<br><br>
                                            Une alerte automatique a été déclenchée sur votre plateforme AynTrace :<br><br>
                                            <span style="font-weight:bold;color:${color};">💬 ${alertMessage}</span>
                                        </p>
                                    </div>
                                    
                                    <a href="http://localhost:8080/devices" style="background-color: #039C51; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block;">
                                        Vérifier sur la plateforme
                                    </a>
                                </div>
                                
                                <!-- Footer -->
                                <div style="padding: 25px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                                    <p style="color: #64748b; font-size: 12px; line-height: 1.6; margin: 0;">
                                        Vous recevez cet email car vous avez activé les notifications pour ce type d'alerte dans vos paramètres.<br>
                                        © ${new Date().getFullYear()} AynTrace Technologies - Tous droits réservés.
                                    </p>
                                </div>
                            </div>
                        </div>
                    `
                }]
            });
        console.log(`[📧 EMAIL] Alert email sent to ${recipientEmail} for ${deviceName} (${alertType})`);
        return true;
    } catch (error) {
        console.error('[📧 EMAIL ERROR]', error.message);
        return false;
    }
}

export async function sendWelcomeEmail(recipientEmail, recipientName, password, plan, enterpriseName, loginUrl) {
    const planLabel = { starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' }[plan] || plan;
    try {
        await mailjetClient
            .post('send', { version: 'v3.1' })
            .request({
                Messages: [{
                    From: { Email: SENDER_EMAIL, Name: SENDER_NAME },
                    To: [{ Email: recipientEmail, Name: recipientName || recipientEmail }],
                    Subject: `Bienvenue sur AynTrace — Vos identifiants d'accès`,
                    HTMLPart: `
                        <div style="background-color: #f1f5f9; padding: 40px 20px; width: 100%; box-sizing: border-box; font-family: 'Inter', Helvetica, Arial, sans-serif;">
                            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.08);">
                                <!-- Header -->
                                <div style="text-align: center; padding: 40px 20px; background-color: #0B1829; background-image: linear-gradient(135deg, #0B1829 0%, #11253E 100%);">
                                    <h1 style="margin: 0; font-size: 32px; font-weight: 900; letter-spacing: -1.5px; font-family: 'Inter', Helvetica, sans-serif;">
                                        <span style="color: #ffffff;">Ayn</span><span style="color: #039C51;">Trace</span>
                                    </h1>
                                    <p style="color: #94a3b8; margin-top: 8px; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">Bienvenue à bord 🎉</p>
                                </div>

                                <!-- Body -->
                                <div style="padding: 40px 30px;">
                                    <h2 style="color: #0B1829; margin-top: 0; font-size: 24px; font-weight: 700; text-align: center;">Votre compte a été créé !</h2>
                                    <p style="color: #475569; line-height: 1.7; font-size: 16px; margin-bottom: 30px; text-align: center;">
                                        Bonjour <strong style="color: #0B1829;">${recipientName || 'Utilisateur'}</strong>,<br><br>
                                        Votre administrateur vous a créé un compte sur la plateforme de géolocalisation <strong style="color: #039C51;">AynTrace</strong>.
                                        Voici vos identifiants de connexion :
                                    </p>

                                    <!-- Credentials Card -->
                                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; margin-bottom: 25px;">
                                        <table style="width: 100%; border-collapse: collapse;">
                                            <tr>
                                                <td style="padding: 12px 0; color: #64748b; font-size: 14px; width: 120px;">📧 Email</td>
                                                <td style="padding: 12px 0; color: #0B1829; font-size: 16px; font-weight: 600;">${recipientEmail}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">🔑 Mot de passe</td>
                                                <td style="padding: 12px 0; border-top: 1px solid #e2e8f0;">
                                                    <code style="background: rgba(3,156,81,0.1); color: #039C51; padding: 8px 16px; border-radius: 6px; font-size: 18px; font-weight: 800; letter-spacing: 2px;">${password}</code>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">📦 Plan</td>
                                                <td style="padding: 12px 0; border-top: 1px solid #e2e8f0; color: #0B1829; font-size: 15px; font-weight: 600;">${planLabel}</td>
                                            </tr>
                                            ${enterpriseName ? `
                                            <tr>
                                                <td style="padding: 12px 0; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">🏢 Entreprise</td>
                                                <td style="padding: 12px 0; border-top: 1px solid #e2e8f0; color: #0B1829; font-size: 15px; font-weight: 600;">${enterpriseName}</td>
                                            </tr>
                                            ` : ''}
                                        </table>
                                    </div>

                                    <!-- CTA -->
                                    <div style="text-align: center; margin: 35px 0;">
                                        <a href="${loginUrl || 'http://localhost:8080/login'}" style="background-color: #039C51; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(3,156,81,0.2);">
                                            Se connecter maintenant →
                                        </a>
                                    </div>

                                    <!-- Warning -->
                                    <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 16px; text-align: center; margin-top: 20px;">
                                        <p style="color: #b91c1c; font-size: 14px; margin: 0; line-height: 1.5;">
                                            🔒 Pour votre sécurité, nous vous recommandons de <strong>changer votre mot de passe</strong> lors de votre première connexion.
                                        </p>
                                    </div>
                                </div>

                                <!-- Footer -->
                                <div style="padding: 25px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                                    <p style="color: #64748b; font-size: 12px; line-height: 1.6; margin: 0;">
                                        Cet email contient des informations confidentielles. Ne le partagez pas.<br>
                                        © ${new Date().getFullYear()} AynTrace Technologies - Tous droits réservés.
                                    </p>
                                </div>
                            </div>
                        </div>
                    `
                }]
            });
        console.log(`[📧 EMAIL] Welcome email sent to ${recipientEmail}`);
        return true;
    } catch (error) {
        console.error('[📧 EMAIL ERROR] Welcome email failed:', error.message);
        return false;
    }
}

export default { generateVerificationCode, sendVerificationEmail, sendPasswordResetEmail, sendStatusUpdateEmail, sendUpgradeConfirmEmail, sendAlertEmail, sendWelcomeEmail };
