// src/components/common/InfoLinks.tsx
// About · FAQ · Contact us · Terms · Privacy: open the website's pages in the browser.
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WEB_URL } from '../../config';
import { showAlert } from './Dialog';
import { colors, space } from '../../theme';

export type InfoSlug = 'about' | 'faq' | 'contact' | 'terms' | 'privacy';

export const INFO_PAGES: { slug: InfoSlug; label: string }[] = [
  { slug: 'about', label: 'About' },
  { slug: 'faq', label: 'FAQ' },
  { slug: 'contact', label: 'Contact us' },
  { slug: 'terms', label: 'Terms of Service' },
  { slug: 'privacy', label: 'Privacy Policy' },
];

export const openInfoPage = (slug: InfoSlug) =>
  Linking.openURL(`${WEB_URL}/${slug}`).catch(() => showAlert("Couldn't open the page", `Visit ${WEB_URL}/${slug} in your browser.`));

const InfoLinks: React.FC = () => (
  <View style={styles.row}>
    {INFO_PAGES.map((page) => (
      <Pressable key={page.slug} onPress={() => openInfoPage(page.slug)} hitSlop={6} accessibilityRole="link">
        <Text style={styles.link}>{page.label}</Text>
      </Pressable>
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: space(4), rowGap: space(1.5), marginTop: space(3) },
  link: { fontSize: 12, color: colors.muted500 },
});

export default InfoLinks;
