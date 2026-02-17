import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function GET(request) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    try {
        const results = {
            mismatched_coupons: [],
            duplicate_card_usage: [],
            orphaned_coupons: []
        };

        // 1. التقاط الكوبونات التي لا ينتمي صاحبها لصاحب المعاملة (Data Pollution Check)
        const { data: coupons, error: couponError } = await supabaseAdmin
            .from('customer_coupons')
            .select('id, customer_id, metadata, created_at')
            .not('metadata->transaction_id', 'is', null)
            .limit(1000);

        if (couponError) throw couponError;

        for (const coupon of coupons) {
            const transId = coupon.metadata?.transaction_id;
            if (transId) {
                const { data: trans } = await supabaseAdmin
                    .from('transactions')
                    .select('customer_id')
                    .eq('id', transId)
                    .maybeSingle();

                if (trans && trans.customer_id !== coupon.customer_id) {
                    results.mismatched_coupons.push({
                        coupon_id: coupon.id,
                        coupon_owner: coupon.customer_id,
                        transaction_owner: trans.customer_id,
                        transaction_id: transId,
                        created_at: coupon.created_at
                    });
                }
            }
        }

        // 2. فحص ما إذا كان هناك بطاقات مرتبطة بأكثر من عميل بشكل غير طبيعي
        const { data: cards, error: cardError } = await supabaseAdmin
            .from('cards')
            .select('uid, customer_id')
            .is('deleted_at', null);

        if (cardError) throw cardError;

        const cardMap = {};
        cards.forEach(c => {
            if (!cardMap[c.uid]) cardMap[c.uid] = [];
            cardMap[c.uid].push(c.customer_id);
        });

        Object.entries(cardMap).forEach(([uid, customers]) => {
            if (customers.length > 1) {
                results.duplicate_card_usage.push({ uid, customers });
            }
        });

        return NextResponse.json({
            success: true,
            summary: "تم الانتهاء من فحص تشخيص البيانات",
            results
        });

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
