import Head from 'next/head';

export default function Home() {
  return (
    <div>
      <Head>
        <title>Recycling India | E-Waste & Circular Economy Platform</title>
        <meta name="description" content="India’s recycling intelligence, marketplace, and circular-economy platform—connecting waste generators, recyclers, buyers, and sustainability businesses." />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "Recycling India",
          "description": "India's recycling intelligence, marketplace, and circular-economy platform"
        })}</script>
      </Head>

      <main>
        <h1>Recycling India</h1>
        <p>India's leading platform for ewaste recycling and circular economy. We connect you with certified ewaste recyclers, provide scrap price intelligence, and support EPR compliance. Join the movement towards sustainable waste management.</p>
        <p>Explore our comprehensive directory of ewaste recyclers, plastic recyclers, and circular economy resources across Mumbai, Delhi, and all India.</p>
      </main>
    </div>
  );
}
