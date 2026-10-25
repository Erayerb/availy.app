import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, themed } from '../theme';

type Props = {
  visible: boolean;
  title: string;
  onScanned: (data: string) => void;
  onClose: () => void;
};

/** Full-screen camera that reads one QR code and closes. */
export function QrScanner({ visible, title, onScanned, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  // The camera reports the same code many times per second; take the first one only
  const handled = useRef(false);

  const handle = ({ data }: { data: string }) => {
    if (handled.current) return;
    handled.current = true;
    onScanned(data);
  };

  return (
    <Modal visible={visible} animationType="slide" onShow={() => { handled.current = false; }} onRequestClose={onClose}>
      <View style={styles.page}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handle}
          />
        ) : (
          <View style={styles.center}>
            <Text style={styles.text}>QR okutmak için kamera izni gerekiyor.</Text>
            <Pressable style={styles.button} onPress={requestPermission}>
              <Text style={styles.buttonText}>Kameraya izin ver</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.top}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.close}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>
        {permission?.granted && <View pointerEvents="none" style={styles.frame} />}
      </View>
    </Modal>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  text: { color: colors.onPrimary, fontSize: 16, textAlign: 'center' },
  button: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, backgroundColor: colors.primary },
  buttonText: { color: colors.onPrimary, fontWeight: '700' },
  top: {
    position: 'absolute',
    top: 54,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: colors.onPrimary, fontSize: 18, fontWeight: '700' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.onPrimary, fontSize: 18 },
  frame: {
    position: 'absolute',
    alignSelf: 'center',
    top: '30%',
    width: 240,
    height: 240,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.onPrimary,
  },
}));
