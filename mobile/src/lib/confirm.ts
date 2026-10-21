import { Alert, Platform } from 'react-native';

/** "Emin misin?" before an action that is hard to undo (web: the browser's dialog). */
export function confirmAction(title: string, message: string, action: string, onConfirm: () => void): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}
