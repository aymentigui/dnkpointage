"use server"
import fs from 'fs/promises';
import path from 'path';
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
    // Configurez ici votre service d'envoi d'emails
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
})

const getEmailTemplate = async (templateName: string): Promise<string> => {
    try {
        const templatePath = path.join(process.cwd(), 'templates', `${templateName}.html`);
        return await fs.readFile(templatePath, 'utf-8');
    } catch (error) {
        console.error(`Erreur lors de la lecture du template ${templateName}:`, error);
        throw new Error(`Impossible de charger le template d'email: ${templateName}`);
    }
};

const replaceTemplateVariables = (template: string, variables: Record<string, string>): string => {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, value);
    }
    return result;
};

export async function sendEmail(to: string, subject: string, html: string) {
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_PORT || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('Email configuration is missing')
        return
    }
    await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject,
        html,
    })
}


export async function sendCode(data: any): Promise<{ status: number; message: string }> {
    try {
        const template = await getEmailTemplate('email-new-code');

        const html = replaceTemplateVariables(template, {
            name: data.code,
        });

        await sendEmail(
            data.email,
            `Confirmation code`,
            html
        );

        return { status: 200, message: 'Email envoyé avec succès' };
    } catch (error) {
        console.error('Erreur lors de l\'envoi de l\'email de code:', error);
        return { status: 500, message: `Erreur: ${(error as Error).message}` };
    }
}

export async function send2FACode(data: any): Promise<{ status: number; message: string }> {
    try {
        const template = await getEmailTemplate('email-new-code-2af');

        const html = replaceTemplateVariables(template, {
            name: data.code,
        });

        await sendEmail(
            data.email,
            `Confirmation 2FA code`,
            html
        );

        return { status: 200, message: 'Email envoyé avec succès' };
    } catch (error) {
        console.error('Erreur lors de l\'envoi de l\'email de code:', error);
        return { status: 500, message: `Erreur: ${(error as Error).message}` };
    }
}