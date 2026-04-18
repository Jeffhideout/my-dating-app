import Stripe from 'stripe'

const stripe = new Stripe('sk_test_51TNIDiPhu5xCuZAU5qlNZkOqsMpd9LREjW2GdWv1mKUX006TP03cIoSyIxM8qd3ZC5vFW6u6plApL9RV1xj9AHzj00sjFGSWB9')

export async function POST(request) {
  try {
    const { packageId, coins, price, packageName, userId } = await request.json()

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${packageName} - ${coins} Coins`,
              description: `Purchase ${coins} coins for HeartLink`,
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `http://localhost:3000/payment/success?session_id={CHECKOUT_SESSION_ID}&user_id=${userId}&coins=${coins}&package_id=${packageId}`,
      cancel_url: `http://localhost:3000/coins`,
      metadata: {
        userId,
        coins,
        packageId,
      },
    })

    return Response.json({ url: session.url })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}