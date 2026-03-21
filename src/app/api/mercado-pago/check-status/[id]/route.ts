import { MercadoPagoConfig, Payment } from 'mercadopago';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const accessToken = searchParams.get('accessToken');

    const token = accessToken || process.env.MERCADO_PAGO_ACCESS_TOKEN;

    if (!token) {
      return NextResponse.json({ error: 'Access Token não configurado' }, { status: 400 });
    }

    const client = new MercadoPagoConfig({ accessToken: token });
    const payment = new Payment(client);

    const result = await payment.get({ id });

    return NextResponse.json({
      status: result.status,
      status_detail: result.status_detail,
    });
  } catch (error: any) {
    console.error('Erro MP Status:', error);
    return NextResponse.json({ error: 'Erro ao verificar status' }, { status: 500 });
  }
}
