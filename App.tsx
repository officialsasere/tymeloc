/**

 *
 * @format
 */

// import { NewAppScreen } from '@react-native/new-app-screen';
import { StatusBar,useColorScheme } from 'react-native';
import {
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';

export default function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'}  />
       <HomeScreen />
    </SafeAreaProvider>
  );
}

