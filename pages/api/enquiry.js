export default function handler(req, res) {
  if (req.method === 'POST') {
    const data = req.body;
    const trackingId = `ENQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    res.status(201).json({
      id: trackingId,
      message: 'Enquiry received successfully',
      received: new Date().toISOString()
    });
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}
