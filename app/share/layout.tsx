import { Metadata } from 'next';

// Force dynamic rendering since we use searchParams for metadata
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<Record<string, string>>;
  searchParams: Promise<{ s?: string }>;
  children: React.ReactNode;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  // Handle case where searchParams might be undefined during static generation
  let stateParam: string | undefined;
  try {
    const searchParams = props.searchParams ? await props.searchParams : null;
    stateParam = searchParams?.s;
  } catch {
    stateParam = undefined;
  }

  // Base URL - in production this would be your actual domain
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://basepaint-fridge.vercel.app';

  // Dynamic OG image URL with the share state
  const ogImageUrl = stateParam
    ? `${baseUrl}/api/og?s=${stateParam}`
    : `${baseUrl}/api/og`;

  // Share URL (this page)
  const shareUrl = stateParam
    ? `${baseUrl}/share?s=${stateParam}`
    : `${baseUrl}/share`;

  // Farcaster miniapp embed
  const fcFrame = {
    version: '1',
    imageUrl: ogImageUrl,
    button: {
      title: 'Open Fridge',
      action: {
        type: 'launch_miniapp',
        name: 'BasePaint Fridge',
        url: baseUrl,
        splashImageUrl: `${baseUrl}/og-image.png`,
        splashBackgroundColor: '#18181b',
      },
    },
  };

  return {
    title: 'Check out my fridge! | BasePaint Fridge',
    description: 'I made this on BasePaint Fridge - come check it out!',
    openGraph: {
      title: 'Check out my fridge!',
      description: 'I made this on BasePaint Fridge - come check it out!',
      images: [ogImageUrl],
      url: shareUrl,
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Check out my fridge!',
      description: 'I made this on BasePaint Fridge - come check it out!',
      images: [ogImageUrl],
    },
    other: {
      'fc:frame': JSON.stringify(fcFrame),
      // Backwards compatibility
      'fc:miniapp': JSON.stringify(fcFrame),
    },
  };
}

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
