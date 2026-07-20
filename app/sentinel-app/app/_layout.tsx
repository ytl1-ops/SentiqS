import { useEffect } from 'react';
import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { useRouter, useSegments } from 'expo-router';
import { useEffect as useEffectInner } from 'react';
import { envoyerRappelWhatsappMobile, ouvrirConversationWhatsapp } from '../lib/rappelsWhatsapp';

SplashScreen.preventAutoHideAsync();

// presenterRappelWhatsapp(numero) : point d'entree unique pour le rappel
// WhatsApp programme, qu'il arrive notification tapee (app en arriere-plan)
// ou recue pendant que l'app est deja ouverte (voir les deux ecouteurs
// ci-dessous) — memes contraintes que le rappel web : rien n'est envoye sans
// ce tap explicite sur "Envoyer".
function presenterRappelWhatsapp(numero: string) {
  Alert.alert(
    '\u{1F4E4} Rapport SENTINEL — prêt à envoyer',
    'Générer le rapport d’analyse et l’envoyer via WhatsApp au ' + numero + ' ?',
    [
      { text: 'Plus tard', style: 'cancel' },
      {
        text: 'Envoyer', style: 'default', onPress: async () => {
          try {
            const { partageNatifOk } = await envoyerRappelWhatsappMobile(numero);
            if (!partageNatifOk) await ouvrirConversationWhatsapp(numero);
          } catch (e: any) {
            Alert.alert('Échec de l’envoi', e?.message || String(e));
          }
        },
      },
    ]
  );
}

function RootNavigator() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffectInner(() => {
    if (isLoading) return;
    SplashScreen.hideAsync();
    const inAuth = segments[0] === '(auth)';
    if (!session && !inAuth) router.replace('/(auth)/login');
    else if (session && inAuth) router.replace('/(app)/feed');
  }, [session, isLoading]);

  useEffectInner(() => {
    const surTap = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'rappel_whatsapp' && typeof data.numero === 'string') presenterRappelWhatsapp(data.numero);
    };
    const surReception = (notif: Notifications.Notification) => {
      const data = notif.request.content.data;
      if (data?.type === 'rappel_whatsapp' && typeof data.numero === 'string') presenterRappelWhatsapp(data.numero);
    };
    const subTap = Notifications.addNotificationResponseReceivedListener(surTap);
    const subReception = Notifications.addNotificationReceivedListener(surReception);
    return () => { subTap.remove(); subReception.remove(); };
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" backgroundColor="#0D1F2D" />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
