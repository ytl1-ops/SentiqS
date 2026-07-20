import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateReport } from './sentinel-api';

// Équivalent mobile natif des "Rappels d'envoi WhatsApp programmés" du site
// web (SENTINEL_Surete_Web.html) : à l'heure choisie, une notification locale
// s'affiche ; un tap (ou, si l'app est déjà ouverte, l'alerte affichée
// directement) déclenche la génération du rapport et son envoi. Même
// contrainte réelle que côté web : aucune API n'autorise l'envoi silencieux
// d'un fichier WhatsApp depuis une app tierce sans geste utilisateur — ce
// module prépare tout à l'avance pour qu'un seul tap suffise.
//
// Partage du fichier réel : expo-sharing ouvre la feuille de partage native
// (WhatsApp y figure comme cible si installé) avec le VRAI PDF en pièce
// jointe — contrairement au lien wa.me du web, qui ne permet jamais
// d'attacher un fichier. En contrepartie, la feuille de partage native ne
// permet pas de présélectionner un contact : c'est pourquoi un second bouton
// ouvre directement la conversation WhatsApp du numéro configuré (deep link
// whatsapp://, message pré-rempli, fichier à joindre manuellement) — les deux
// options sont complémentaires, comme le double-parcours déjà en place côté
// web (partage natif en premier, repli texte sinon).

const CONFIG_KEY = 'sentinel_rappels_whatsapp_mobile_v1';
const NOTIF_IDS_KEY = 'sentinel_rappels_whatsapp_notif_ids_v1';
const HEURE_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type RappelsWhatsappConfig = {
  actif: boolean;
  numero: string;
  heures: string[];
};

const DEFAUT: RappelsWhatsappConfig = { actif: false, numero: '', heures: ['08:00'] };

export async function getRappelsWhatsappConfig(): Promise<RappelsWhatsappConfig> {
  try {
    const raw = await AsyncStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAUT;
    return { ...DEFAUT, ...JSON.parse(raw) };
  } catch {
    return DEFAUT;
  }
}

async function saveRappelsWhatsappConfig(cfg: RappelsWhatsappConfig): Promise<void> {
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

// annulerRappelsWhatsapp() : annule toutes les notifications programmées par
// ce module (jamais celles d'alertes critiques, gérées séparément par
// notifications.ts) avant d'en reprogrammer un nouveau jeu — évite
// l'accumulation de rappels obsolètes à chaque modification des horaires.
export async function annulerRappelsWhatsapp(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_IDS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    await Promise.all(ids.map(id => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
  } catch { /* silencieux — pas grave si l'annulation echoue partiellement */ }
  await AsyncStorage.setItem(NOTIF_IDS_KEY, JSON.stringify([]));
}

// enregistrerEtProgrammerRappels(cfg) : valide/normalise, sauvegarde, puis
// (re)programme les notifications quotidiennes recurrentes. Retourne la
// config effectivement enregistree (heures invalides filtrees) pour que
// l'ecran de parametres puisse refleter ce qui a reellement ete pris en
// compte.
export async function enregistrerEtProgrammerRappels(input: {
  actif: boolean; numero: string; heures: string;
}): Promise<RappelsWhatsappConfig> {
  const cfg: RappelsWhatsappConfig = {
    actif: input.actif,
    numero: (input.numero || '').replace(/[^\d]/g, ''),
    heures: input.heures.split(',').map(h => h.trim()).filter(h => HEURE_RE.test(h)),
  };
  await saveRappelsWhatsappConfig(cfg);
  await annulerRappelsWhatsapp();

  if (cfg.actif && cfg.numero && cfg.heures.length) {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('rappels-whatsapp', {
        name: 'Rappels d’envoi WhatsApp',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const ids: string[] = [];
    for (const hhmm of cfg.heures) {
      const [hour, minute] = hhmm.split(':').map(Number);
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '\u{1F4E4} Rapport SENTINEL — prêt à envoyer',
          body: 'Appuyez pour générer et envoyer le rapport d’analyse via WhatsApp.',
          sound: true,
          data: { type: 'rappel_whatsapp', numero: cfg.numero },
        },
        trigger: {
          hour, minute, repeats: true,
          ...(Platform.OS === 'android' ? { channelId: 'rappels-whatsapp' } : {}),
        } as Notifications.DailyTriggerInput,
      });
      ids.push(id);
    }
    await AsyncStorage.setItem(NOTIF_IDS_KEY, JSON.stringify(ids));
  }
  return cfg;
}

// envoyerRappelWhatsappMobile(numero) : DOIT etre appelee depuis un geste
// utilisateur reel (tap sur la notification ou sur le bouton "Envoyer
// maintenant" de l'alerte in-app) — memes contraintes systeme que
// Sharing.shareAsync/Linking.openURL cote natif. Genere le rapport de
// synthese du jour (meme appel que l'ecran Rapports, voir reports.tsx), le
// telecharge sur l'appareil, puis propose le partage natif AVEC LE FICHIER
// REEL en priorite.
export async function envoyerRappelWhatsappMobile(numero: string): Promise<{ partageNatifOk: boolean }> {
  const dateTo = new Date().toISOString().split('T')[0];
  const dateFrom = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const result = await generateReport({
    date_from: dateFrom, date_to: dateTo, format: 'pdf', include_map: true, language: 'fr',
  });
  const localPath = `${FileSystem.documentDirectory}SENTINEL_Synthese_${dateTo}.pdf`;
  const dl = await FileSystem.downloadAsync(result.url, localPath);

  let partageNatifOk = false;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(dl.uri, { mimeType: 'application/pdf', dialogTitle: 'Rapport SENTINEL — Synthèse analytique' });
    partageNatifOk = true;
  }

  return { partageNatifOk };
}

// ouvrirConversationWhatsapp(numero) : deep link natif whatsapp:// (aucun
// blocage popup contrairement a window.open sur le web) — ouvre directement
// la conversation du numero configure avec un message pret ; le PDF, deja
// telecharge/partage via envoyerRappelWhatsappMobile, est a joindre depuis la
// feuille de partage WhatsApp elle-meme (aucune API ne permet de combiner
// "contact preselectionne" + "fichier joint" en un seul appel, cote mobile
// comme cote web).
export async function ouvrirConversationWhatsapp(numero: string): Promise<void> {
  const texte = 'SENTINEL SÛRETÉ — Rapport d’analyse (Synthèse analytique) du ' +
    new Date().toLocaleDateString('fr-FR') + '.\n\nLe PDF vient d’être partagé/téléchargé sur cet appareil — joignez-le à ce message si ce n’est pas déjà fait.';
  const url = 'whatsapp://send?phone=' + numero + '&text=' + encodeURIComponent(texte);
  const peutOuvrir = await Linking.canOpenURL(url);
  if (peutOuvrir) await Linking.openURL(url);
  else await Linking.openURL('https://wa.me/' + numero + '?text=' + encodeURIComponent(texte));
}
