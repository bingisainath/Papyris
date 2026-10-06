// src/hooks/useKeyboardOffset.ts
// Lift a screen's content so it sits directly above the keyboard, on any phone.
//
// How: when the keyboard opens, measure where the container's bottom edge is and where the top
// of the keyboard is, both in the app's own coordinates, and pad by exactly the overlap.
// Measuring (instead of assuming) keeps it right everywhere:
//   - Android 15+ draws apps edge-to-edge and doesn't resize -> overlap = keyboard height
//   - Android 14 and older (adjustResize) resize the app -> the content already moved, overlap ~0
//   - iOS never resizes -> overlap = keyboard height above the content
// It returns to 0 when the keyboard hides.
//
// Coordinates: the container is measured with measure() (pageY, relative to the root view) and the
// keyboard's top is placed in that same root view, whose height is recorded in App.tsx while the
// keyboard is closed. measureInWindow() can't be used: on Android it subtracts the status bar.
//
// Why not KeyboardAvoidingView: it compares its frame (relative to its parent) with the keyboard's
// absolute screen position, bridged by a hand-tuned keyboardVerticalOffset; with a native
// header, safe areas and edge-to-edge windows that doesn't line up and it over-lifted.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, KeyboardEvent, LayoutAnimation, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Height of the app's root view with the keyboard closed (set by KeyboardRoot in App.tsx)
let rootHeight = 0;
export function recordRootHeight(height: number) {
  if (!Keyboard.isVisible()) rootHeight = height;
}

export function useKeyboardOffset() {
  const ref = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const insetsRef = useRef(insets);
  insetsRef.current = insets;
  const [offset, setOffset] = useState(0);

  const apply = useCallback((e: KeyboardEvent | null) => {
    if (Platform.OS === 'ios') {
      LayoutAnimation.configureNext({ duration: e?.duration || 250, update: { type: LayoutAnimation.Types.keyboard } });
    }
    const node = ref.current;
    if (!e || !node) {
      setOffset(0);
      return;
    }
    // Distance from the bottom of the screen to the top of the keyboard. React Native on Android
    // reports the keyboard height without the navigation-bar strip below it; iOS includes it.
    const reported = e.endCoordinates.height;
    const fromBottom = Platform.OS === 'android' ? reported + insetsRef.current.bottom : reported;
    // The root reaches the bottom of the screen, so the keyboard's top in root coordinates is:
    const keyboardTop = (rootHeight || Dimensions.get('window').height) - fromBottom;
    // Padding is applied inside the container, so its own frame (and this measurement) doesn't move
    // measure() reports pageY relative to the root view, the same frame as rootHeight.
    // (measureInWindow() on Android subtracts the status bar, which put the input under the keyboard.)
    node.measure((_x, _y, _w, height, _pageX, pageY) => {
      const next = Math.max(0, Math.round(pageY + height - keyboardTop));
      setOffset(next);
    });
  }, []);

  useEffect(() => {
    // iOS has "will" events, so the content moves together with the keyboard
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, apply);
    const hide = Keyboard.addListener(hideEvent, () => apply(null));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [apply]);

  return { ref, offset };
}
