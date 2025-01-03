import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState, useEffect, useRef } from 'react';
import { Button, StyleSheet, Text, View, FlatList, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

interface ScannedData {
  participant: string;
  position: number;
}

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedData, setScannedData] = useState<ScannedData[]>([]);
  const [currentParticipant, setCurrentParticipant] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const bannerAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loadScannedData = async () => {
      try {
        const storedData = await AsyncStorage.getItem('scannedData');
        if (storedData) {
          setScannedData(JSON.parse(storedData));
        }
      } catch (error) {
        console.error('Failed to load scanned data', error);
      }
    };

    loadScannedData();
  }, []);

  useEffect(() => {
    const saveScannedData = async () => {
      try {
        await AsyncStorage.setItem('scannedData', JSON.stringify(scannedData));
      } catch (error) {
        console.error('Failed to save scanned data', error);
      }
    };

    saveScannedData();
  }, [scannedData]);

  const clearStorage = async () => {
    try {
      await AsyncStorage.clear();
      setScannedData([]);
      showBanner('Storage cleared. All data has been wiped.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to clear storage', error);
    }
  };

  const showBanner = (message: string) => {
    setBannerMessage(message);
    Animated.timing(bannerAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(bannerAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setBannerMessage(null);
        });
      }, 3000);
    });
  };

  if (!permission) {
    // Camera permissions are still loading.
    return <View />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (!currentParticipant) {
      if (data.startsWith('G10k')) {
        if (!scannedData.some(item => item.participant === data)) {
          setCurrentParticipant(data);
          showBanner(`Participant QR Code scanned! Participant: ${data}. Please scan the finish token.`);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          showBanner(`Participant QR Code already scanned! Participant: ${data}`);
        }
      } else {
        showBanner('Invalid QR Code. The QR code must start with "G10k".');
      }
    } else {
      const position = parseInt(data, 10);
      if (!isNaN(position)) {
        if (!scannedData.some(item => item.position === position)) {
          setScannedData([...scannedData, { participant: currentParticipant, position }]);
          showBanner(`Finish token scanned! Participant: ${currentParticipant}, Position: ${position}`);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setCurrentParticipant(null);
        } 
        // else {
        //   showBanner(`Finish token already scanned! Position: ${position}`);
        // }
      } else {
        showBanner('Invalid Finish Token. The finish token must be a numeric value.');
      }
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['code39', 'qr'],
        }}
      />
      {bannerMessage && (
        <Animated.View style={[styles.banner, { transform: [{ translateY: bannerAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [100, 0],
        }) }] }]}>
          <Text style={styles.bannerText}>{bannerMessage}</Text>
        </Animated.View>
      )}
      <View style={styles.tableContainer}>
        <FlatList
          data={scannedData}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>{item.participant}</Text>
              <Text style={styles.tableCell}>{item.position}</Text>
            </View>
          )}
          ListHeaderComponent={
            <View style={styles.tableRow}>
              <Text style={styles.tableHeader}>Participant</Text>
              <Text style={styles.tableHeader}>Position</Text>
            </View>
          }
        />
      </View>
      <Button title="Clear Storage" onPress={clearStorage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
  },
  camera: {
    flex: 3,
  },
  tableContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  tableCell: {
    flex: 1,
    textAlign: 'center',
  },
  tableHeader: {
    flex: 1,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  banner: {
    backgroundColor: '#4CAF50',
    padding: 10,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  bannerText: {
    color: '#fff',
    textAlign: 'center',
  },
});