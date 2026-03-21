import { MercadoPagoConfig, Payment } from 'mercadopago';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { amount, external_reference, accessToken } = await request.json();

    console.log(`GERANDO PIX: Valor=${amount}, Ref=${external_reference}, Token=${accessToken ? 'FORNECIDO' : 'ENV'}`);

    const token = accessToken || process.env.MERCADO_PAGO_ACCESS_TOKEN;

    if (!token) {
      return NextResponse.json({ error: 'Access Token não configurado' }, { status: 400 });
    }

    const client = new MercadoPagoConfig({ 
      accessToken: token,
      options: { timeout: 10000 }
    });
    
    const payment = new Payment(client);
    const idempotencyKey = crypto.randomUUID();

    const body = {
      transaction_amount: Number(amount),
      description: `Créditos Jukebox - Máquina ${external_reference}`,
      payment_method_id: 'pix',
      external_reference: external_reference,
      payer: {
        email: 'cliente@tecnofox.com.br', // Email válido para evitar bloqueios de teste
      },
    };

    const response = await payment.create({ 
      body,
      requestOptions: { idempotencyKey }
    });

    return NextResponse.json({
      id: response.id,
      qr_code: response.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: response.point_of_interaction?.transaction_data?.qr_code_base64,
      status: response.status
    });
  } catch (error: any) {
    console.error('ERRO DETALHADO MERCADO PAGO:', error);
    // Extrai a mensagem de erro da resposta do MP se disponível
    const errorMessage = error.message || 'Erro desconhecido';
    const errorDetail = error.response?.data?.message || '';

    return NextResponse.json({ 
      error: 'Erro ao gerar Pix', 
      message: errorMessage,
      details: errorDetail
    }, { status: 500 });
  }
}
