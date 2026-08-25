import { detectSmallTalk, smallTalkReply } from './small-talk';

describe('detectSmallTalk', () => {
  it('nhận ra lời chào có dấu, không dấu và tiếng Anh', () => {
    for (const q of ['Xin chào', 'xin chao', 'chào', 'hello', 'Hi!', 'alo']) {
      expect(detectSmallTalk(q)).toBe('greeting');
    }
  });

  it('nhận ra lời chào kèm xưng hô và hư từ', () => {
    for (const q of ['chào shop', 'chào bạn nhé', 'xin chào ạ', 'hi shop']) {
      expect(detectSmallTalk(q)).toBe('greeting');
    }
  });

  it('nhận ra cảm ơn và tạm biệt', () => {
    expect(detectSmallTalk('cảm ơn')).toBe('thanks');
    expect(detectSmallTalk('cám ơn bạn nhé')).toBe('thanks');
    expect(detectSmallTalk('thanks')).toBe('thanks');
    expect(detectSmallTalk('tạm biệt')).toBe('goodbye');
    expect(detectSmallTalk('bye')).toBe('goodbye');
  });

  it('nhận ra câu hỏi về chính con bot', () => {
    expect(detectSmallTalk('bạn là ai')).toBe('identity');
    expect(detectSmallTalk('Bạn tên gì?')).toBe('identity');
    expect(detectSmallTalk('bạn làm được gì')).toBe('capability');
    expect(detectSmallTalk('bạn hỗ trợ gì')).toBe('capability');
  });

  // ⭐ Nhóm test quan trọng nhất: nuốt nhầm câu hỏi thật tệ hơn nhiều so với
  // bỏ sót một lời chào.
  it('KHÔNG nuốt câu hỏi thật có chứa lời chào', () => {
    expect(
      detectSmallTalk('chào shop, cho mình hỏi học phí bao nhiêu'),
    ).toBeNull();
    expect(detectSmallTalk('cảm ơn, cho hỏi thêm về chính sách đổi trả')).toBeNull();
  });

  it('KHÔNG khớp chuỗi con: "chào giá", "chào bán" là từ nội dung', () => {
    expect(detectSmallTalk('chào giá sản phẩm này thế nào')).toBeNull();
    expect(detectSmallTalk('bảng chào giá')).toBeNull();
  });

  it('câu hỏi thường trả về null', () => {
    expect(detectSmallTalk('nền tảng có tính năng gì')).toBeNull();
    expect(detectSmallTalk('phí vận chuyển bao nhiêu')).toBeNull();
    expect(detectSmallTalk('mã đơn ACM-2024-3391 tới đâu rồi')).toBeNull();
  });

  it('chuỗi rỗng hoặc chỉ dấu câu trả về null', () => {
    expect(detectSmallTalk('')).toBeNull();
    expect(detectSmallTalk('   ')).toBeNull();
    expect(detectSmallTalk('???')).toBeNull();
  });
});

describe('smallTalkReply', () => {
  it('trả câu đáp sẵn cho xã giao, null cho câu hỏi thật', () => {
    expect(smallTalkReply('xin chào')).toContain('Xin chào');
    expect(smallTalkReply('phí vận chuyển bao nhiêu')).toBeNull();
  });

  it('mọi câu đáp đều mời khách hỏi tiếp', () => {
    for (const q of ['xin chào', 'cảm ơn', 'bạn là ai', 'bạn làm được gì']) {
      expect(smallTalkReply(q)).toMatch(/hỏi|tìm hiểu|hỗ trợ/);
    }
  });
});
