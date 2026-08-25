import { keywordQueryText, stripAccents } from './keyword-query';

describe('stripAccents', () => {
  it('bỏ mọi dấu thanh và dấu mũ', () => {
    expect(stripAccents('hoàn tiền')).toBe('hoan tien');
    expect(stripAccents('phí vận chuyển')).toBe('phi van chuyen');
  });

  it('⭐ xử lý được đ/Đ — NFD KHÔNG tách được chữ này', () => {
    expect(stripAccents('đơn hàng')).toBe('don hang');
    expect(stripAccents('Đổi trả')).toBe('Doi tra');
  });

  it('chữ hai dấu (mũ + thanh) cũng sạch', () => {
    expect(stripAccents('ầ ặ ỡ ữ ị ế ộ')).toBe('a a o u i e o');
  });

  it('không đụng chữ và số không dấu', () => {
    expect(stripAccents('ACM-2024-3391')).toBe('ACM-2024-3391');
  });
});

describe('keywordQueryText', () => {
  it('giữ từ nội dung, bỏ hư từ có dấu', () => {
    expect(keywordQueryText('phí hoàn tiền của tôi là bao nhiêu')).toBe(
      'phí hoàn tiền bao',
    );
  });

  it('⭐ hư từ gõ KHÔNG DẤU cũng bị lọc', () => {
    // Trước khi có STOP_WORDS_BARE, "cua" và "la" lọt qua và làm nhiễu ts_rank.
    const out = keywordQueryText('phi hoan tien cua toi la bao nhieu');
    expect(out).not.toContain('cua');
    expect(out).not.toContain(' la ');
    expect(out).toContain('phi');
    expect(out).toContain('hoan');
  });

  it('⭐ KHÔNG lọc từ nội dung trùng dạng không dấu với hư từ', () => {
    // Đây là lý do có hai bảng thay vì bỏ dấu cả STOP_WORDS: những từ này
    // là hàng hoá thật của khách, mất chúng là mất đúng thứ đáng tìm nhất.
    for (const w of ['may', 'ban', 'chi', 'ma', 'da', 'qua', 'the', 'bao']) {
      expect(keywordQueryText(`${w} tinh`).split(' ')).toContain(w);
    }
  });

  it('bỏ dấu câu hai đầu, giữ nguyên mã có gạch nối', () => {
    expect(keywordQueryText('đơn "ACM-2024-3391"!')).toBe('đơn acm-2024-3391');
  });

  it('token 1 ký tự bị bỏ', () => {
    expect(keywordQueryText('a b phí')).toBe('phí');
  });

  it('câu chỉ toàn hư từ → chuỗi rỗng (nhánh từ khoá sẽ bị bỏ qua)', () => {
    expect(keywordQueryText('cái đó là gì vậy')).toBe('cái');
    expect(keywordQueryText('có không')).toBe('');
  });
});
