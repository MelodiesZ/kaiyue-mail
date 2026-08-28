import path from 'path';

const { DatabaseSync } = require('node:sqlite');

export const KAIYUE_FIXTURE_ACCOUNT_ID = 'kyue0001';

const contact = (name: string, email: string) => ({
  name,
  email,
  h: false,
  s: 'mail',
  gis: [],
  __cls: 'Contact',
});

const folder = (id: string, role: string | null, folderPath: string) => ({
  id,
  aid: KAIYUE_FIXTURE_ACCOUNT_ID,
  v: 1,
  role,
  path: folderPath,
  localStatus: {
    syncedMinUID: 1,
    bodiesPresent: 20,
    bodiesWanted: 20,
    uidnext: 21,
    busy: false,
  },
  __cls: 'Folder',
});

const folders = [
  folder('folder-inbox', 'inbox', 'INBOX'),
  folder('folder-sent', 'sent', 'Sent'),
  folder('folder-drafts', 'drafts', 'Drafts'),
  folder('folder-archive', 'archive', 'Archive'),
  folder('folder-trash', 'trash', 'Trash'),
  folder('folder-spam', 'spam', 'Spam'),
  folder('folder-projects', null, '客户项目'),
  folder('folder-project-ky2500', null, '客户项目/KY-2500'),
  folder('folder-suppliers', null, '供应商往来'),
  folder('folder-records', null, '资料归档'),
];

const inbox = folders[0];

const threadSeeds = [
  {
    id: 'thread-quote-001',
    subject: '液压钻机 KY-2500 报价确认',
    snippet: '请确认最新报价、随机配件与预计交付周期。',
    sender: contact('王海峰', 'wanghaifeng@customer.cn'),
    unread: true,
    starred: true,
    attachment: {
      id: 'file-quote-pdf',
      filename: 'KY-2500-报价单.pdf',
      size: 486000,
      contentType: 'application/pdf',
    },
    body: `
      <p>凯越团队，你们好：</p>
      <img src="https://assets.example.com/kaiyue-project-header.png" alt="KY-2500 项目标识" width="620" height="72" />
      <p>我们已完成 KY-2500 液压钻机的内部技术评审，请帮忙确认以下信息：</p>
      <table style="border-collapse:collapse;width:100%;max-width:620px">
        <tr><td style="padding:8px;border:1px solid #dce3ec"><strong>交付地点</strong></td><td style="padding:8px;border:1px solid #dce3ec">山东省临沂市</td></tr>
        <tr><td style="padding:8px;border:1px solid #dce3ec"><strong>数量</strong></td><td style="padding:8px;border:1px solid #dce3ec">2 台</td></tr>
        <tr><td style="padding:8px;border:1px solid #dce3ec"><strong>目标到货</strong></td><td style="padding:8px;border:1px solid #dce3ec">2026 年 9 月 18 日前</td></tr>
      </table>
      <p>附件是我方标注后的报价单，如无异议，请回复可排产日期。</p>
      <p>谢谢！<br />王海峰<br />采购中心</p>
    `,
  },
  {
    id: 'thread-parts-002',
    subject: 'Re: 8 月配件采购清单',
    snippet: '密封件、钻杆和液压接头已按清单备货。',
    sender: contact('李娜', 'lina@supplier.cn'),
    unread: false,
    starred: false,
    body: '<p>配件已按新版清单备货，预计周五下午送达蒙阴厂区。</p><p>如需调整数量，请在明天中午前告知。</p><p><a href="https://supplier.example.com/unsubscribe">退订供应商到货通知</a></p>',
  },
  {
    id: 'thread-inspection-003',
    subject: '蒙阴厂区设备巡检计划',
    snippet: '本周巡检将重点检查液压系统、焊接工位与安全防护。',
    sender: contact('生产管理部', 'production@kaiyuedrill.com'),
    unread: true,
    starred: false,
    body: '<p>各车间负责人：</p><p>请于本周四 16:00 前完成设备自检并提交记录。巡检现场需保持通道畅通、标识清晰。</p>',
  },
  {
    id: 'thread-contract-004',
    subject: '合同盖章件已回传',
    snippet: '双方盖章页已合并，请归档至客户项目目录。',
    sender: contact('张经理', 'zhang.manager@partner.cn'),
    unread: false,
    starred: true,
    body: '<p>合同盖章件已回传，付款节点与前版一致。请完成归档后回复档案编号。</p>',
  },
  {
    id: 'thread-meeting-005',
    subject: '下周技术交流会议安排',
    snippet: '议程包括新型钻机控制系统、售后问题复盘和样机测试。',
    sender: contact('技术中心', 'engineering@kaiyuedrill.com'),
    unread: false,
    starred: false,
    body: '<p>会议时间：下周二 09:30–11:00。</p><p>请各模块负责人准备 5 分钟进度说明和待决策事项。</p>',
  },
  {
    id: 'thread-sales-006',
    subject: '8 月海外项目跟进汇总',
    snippet: '东南亚代理商已确认样机演示时间，请同步准备英文技术资料。',
    sender: contact('海外事业部', 'overseas@kaiyuedrill.com'),
    unread: false,
    starred: false,
    body: '<p>本月重点项目进展已汇总完成。</p><p>请技术中心在周五前补齐 KY-2500 英文参数表、运输尺寸及易损件清单。</p>',
  },
];

function insertFolderRows(db: any, now: number) {
  const insert = db.prepare(
    'INSERT OR REPLACE INTO Folder (id, accountId, version, data, path, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const item of folders) {
    insert.run(
      item.id,
      KAIYUE_FIXTURE_ACCOUNT_ID,
      1,
      JSON.stringify(item),
      item.path,
      item.role,
      now,
      now
    );
  }
}

function insertMailRows(db: any, now: number) {
  const insertThread = db.prepare(
    `INSERT OR REPLACE INTO Thread
      (id, accountId, version, data, gThrId, subject, snippet, unread, starred,
       firstMessageTimestamp, lastMessageTimestamp, lastMessageReceivedTimestamp,
       lastMessageSentTimestamp, inAllMail, isSearchIndexed, participants, hasAttachments)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertMessage = db.prepare(
    `INSERT OR REPLACE INTO Message
      (id, accountId, version, data, headerMessageId, gMsgId, gThrId, subject, date,
       draft, unread, starred, remoteUID, remoteXGMLabels, remoteFolderId,
       replyToHeaderMessageId, threadId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertBody = db.prepare(
    'INSERT OR REPLACE INTO MessageBody (id, value, fetchedAt) VALUES (?, ?, ?)'
  );
  const insertJoin = db.prepare(
    `INSERT OR REPLACE INTO ThreadCategory
      (id, value, inAllMail, unread, lastMessageReceivedTimestamp, lastMessageSentTimestamp)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insertFile = db.prepare(
    'INSERT OR REPLACE INTO File (id, version, data, accountId, filename) VALUES (?, ?, ?, ?, ?)'
  );
  const insertThreadSearch = db.prepare(
    `INSERT INTO ThreadSearch (content_id, subject, to_, from_, categories, body)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  threadSeeds.forEach((seed, index) => {
    const timestamp = now - index * 3720;
    const messageId = `message-${String(index + 1).padStart(3, '0')}`;
    const files = seed.attachment
      ? [
          {
            ...seed.attachment,
            aid: KAIYUE_FIXTURE_ACCOUNT_ID,
            v: 1,
            messageId,
            __cls: 'File',
          },
        ]
      : [];
    const recipients = [contact('凯越邮箱', 'design@kaiyuedrill.com')];
    const threadJSON = {
      id: seed.id,
      aid: KAIYUE_FIXTURE_ACCOUNT_ID,
      v: 1,
      metadata: [],
      subject: seed.subject,
      snippet: seed.snippet,
      unread: seed.unread,
      starred: seed.starred,
      folders: [inbox],
      labels: [],
      participants: [seed.sender, ...recipients],
      attachmentCount: files.length,
      fmt: timestamp,
      lmrt: timestamp,
      lmst: 0,
      inAllMail: true,
      __cls: 'Thread',
    };
    const messageJSON = {
      id: messageId,
      aid: KAIYUE_FIXTURE_ACCOUNT_ID,
      v: 1,
      metadata: [],
      to: recipients,
      cc: [],
      bcc: [],
      from: [seed.sender],
      replyTo: [],
      date: timestamp,
      files,
      unread: seed.unread,
      events: [],
      starred: seed.starred,
      snippet: seed.snippet,
      threadId: seed.id,
      hMsgId: `<${messageId}@kaiyuedrill.com>`,
      subject: seed.subject,
      draft: false,
      pristine: false,
      plaintext: false,
      folder: inbox,
      __cls: 'Message',
    };

    insertThread.run(
      seed.id,
      KAIYUE_FIXTURE_ACCOUNT_ID,
      1,
      JSON.stringify(threadJSON),
      null,
      seed.subject,
      seed.snippet,
      seed.unread ? 1 : 0,
      seed.starred ? 1 : 0,
      timestamp,
      timestamp,
      timestamp,
      0,
      1,
      1,
      JSON.stringify(threadJSON.participants),
      files.length
    );
    insertMessage.run(
      messageId,
      KAIYUE_FIXTURE_ACCOUNT_ID,
      1,
      JSON.stringify(messageJSON),
      messageJSON.hMsgId,
      null,
      null,
      seed.subject,
      timestamp,
      0,
      seed.unread ? 1 : 0,
      seed.starred ? 1 : 0,
      index + 1,
      null,
      inbox.id,
      null,
      seed.id
    );
    insertBody.run(messageId, seed.body, timestamp);
    insertJoin.run(seed.id, inbox.id, 1, seed.unread ? 1 : 0, timestamp, 0);
    insertThreadSearch.run(
      seed.id,
      seed.subject,
      recipients.map((recipient) => `${recipient.name} ${recipient.email}`).join(' '),
      `${seed.sender.name} ${seed.sender.email}`,
      `${inbox.id} ${inbox.path} ${inbox.role} 收件箱`,
      seed.body.replace(/<[^>]+>/g, ' ')
    );

    for (const file of files) {
      insertFile.run(file.id, 1, JSON.stringify(file), KAIYUE_FIXTURE_ACCOUNT_ID, file.filename);
    }
  });

  const draftId = 'draft-kaiyue-001';
  const draftTimestamp = now - 540;
  const draftFolder = folders.find((item) => item.role === 'drafts');
  const draftJSON = {
    id: draftId,
    aid: KAIYUE_FIXTURE_ACCOUNT_ID,
    v: 1,
    metadata: [],
    to: [contact('李娜', 'lina@supplier.cn')],
    cc: [contact('技术中心', 'engineering@kaiyuedrill.com')],
    bcc: [],
    from: [contact('凯越邮箱', 'design@kaiyuedrill.com')],
    replyTo: [],
    date: draftTimestamp,
    files: [],
    unread: false,
    events: [],
    starred: false,
    snippet: '补充液压接头规格与到货批次后发送。',
    threadId: null,
    hMsgId: '<draft-kaiyue-001@kaiyuedrill.com>',
    subject: '8 月配件采购清单补充说明',
    draft: true,
    pristine: true,
    plaintext: false,
    folder: draftFolder,
    __cls: 'Message',
  };
  const draftBody =
    '<p>李娜，你好：</p><p>请在清单中补充液压接头规格与对应到货批次，确认后即可发送。</p>';
  insertMessage.run(
    draftId,
    KAIYUE_FIXTURE_ACCOUNT_ID,
    1,
    JSON.stringify(draftJSON),
    draftJSON.hMsgId,
    null,
    null,
    draftJSON.subject,
    draftTimestamp,
    1,
    0,
    0,
    null,
    null,
    draftFolder.id,
    null,
    null
  );
  insertBody.run(draftId, draftBody, draftTimestamp);

  const unread = threadSeeds.filter((item) => item.unread).length;
  const count = db.prepare(
    'INSERT OR REPLACE INTO ThreadCounts (categoryId, unread, total) VALUES (?, ?, ?)'
  );
  count.run(inbox.id, unread, threadSeeds.length);
  for (const item of folders.slice(1)) count.run(item.id, 0, item.role === 'drafts' ? 1 : 0);
}

function insertContactRows(db: any) {
  const insert = db.prepare(
    `INSERT OR REPLACE INTO Contact
      (id, data, accountId, email, version, refs, hidden, source, bookId, etag)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const contacts = [
    ['contact-wang', '王海峰', 'wanghaifeng@customer.cn', 18, 'carddav'],
    ['contact-li', '李娜', 'lina@supplier.cn', 13],
    ['contact-zhang', '张经理', 'zhang.manager@partner.cn', 9],
    ['contact-engineering', '技术中心', 'engineering@kaiyuedrill.com', 22],
  ];
  for (const [id, name, email, refs, source = 'mail'] of contacts) {
    const vcf = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:王;海峰;;;',
      'FN:王海峰',
      'ORG:临沂恒川工程设备有限公司',
      'TITLE:采购中心经理',
      'EMAIL;TYPE=WORK:wanghaifeng@customer.cn',
      'TEL;TYPE=MOBILE:+86 138 0000 2500',
      'ADR;TYPE=WORK:;;兰山区工业路 88 号;临沂市;山东省;276000;中国',
      'NOTE:KY-2500 项目采购联系人',
      'END:VCARD',
      '',
    ].join('\r\n');
    const data = {
      id,
      aid: KAIYUE_FIXTURE_ACCOUNT_ID,
      v: 1,
      name,
      email,
      h: false,
      s: source,
      gis: [],
      refs,
      ...(source === 'carddav' ? { info: { vcf, href: '/fixture/contact-wang.vcf' } } : {}),
      __cls: 'Contact',
    };
    insert.run(
      id,
      JSON.stringify(data),
      KAIYUE_FIXTURE_ACCOUNT_ID,
      email,
      1,
      refs,
      0,
      source,
      null,
      null
    );
  }
}

function insertCalendarRows(db: any) {
  // Keep visual tests independent of the day they run. The calendar test
  // explicitly focuses this date before capturing screenshots.
  const start = new Date(2026, 7, 26, 10, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const startUnix = Math.floor(start.getTime() / 1000);
  const endUnix = Math.floor(end.getTime() / 1000);
  const date = (value: Date) =>
    value
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');
  const calendarId = 'calendar-kaiyue';
  const calendarJSON = {
    id: calendarId,
    aid: KAIYUE_FIXTURE_ACCOUNT_ID,
    name: '凯越工作日历',
    description: '项目、生产与客户沟通安排',
    read_only: false,
    color: '#1A3B70',
    order: 0,
    __cls: 'Calendar',
  };
  db.prepare('INSERT OR REPLACE INTO Calendar (id, data, accountId) VALUES (?, ?, ?)').run(
    calendarId,
    JSON.stringify(calendarJSON),
    KAIYUE_FIXTURE_ACCOUNT_ID
  );

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kaiyue Mail//UI Fixture//CN',
    'BEGIN:VEVENT',
    'UID:kaiyue-review-001',
    `DTSTAMP:${date(start)}`,
    `DTSTART:${date(start)}`,
    `DTEND:${date(end)}`,
    'SUMMARY:KY-2500 项目评审',
    'LOCATION:二楼会议室',
    'DESCRIPTION:确认交付周期与技术配置',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const eventJSON = {
    id: 'event-kaiyue-review',
    aid: KAIYUE_FIXTURE_ACCOUNT_ID,
    cid: calendarId,
    ics,
    icsuid: 'kaiyue-review-001',
    rid: '',
    status: 'CONFIRMED',
    rs: startUnix,
    re: endUnix,
    __cls: 'Event',
  };
  db.prepare(
    `INSERT OR REPLACE INTO Event
      (id, data, accountId, etag, calendarId, recurrenceStart, recurrenceEnd, icsuid, recurrenceId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    eventJSON.id,
    JSON.stringify(eventJSON),
    KAIYUE_FIXTURE_ACCOUNT_ID,
    'fixture-etag-1',
    calendarId,
    startUnix,
    endUnix,
    eventJSON.icsuid,
    ''
  );
}

/**
 * Populates a freshly migrated test database with deterministic, company-relevant data.
 * Returns true when rows were inserted and the renderer should be reloaded.
 */
export function seedKaiyueFixtureDatabase(configDir: string): boolean {
  const dbPath = path.join(configDir, 'edgehill.db');
  const db = new DatabaseSync(dbPath);
  try {
    db.exec('PRAGMA busy_timeout = 5000');
    const schema = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Thread'")
      .get();
    if (!schema) return false;
    const existing = db.prepare('SELECT COUNT(*) AS count FROM Thread').get() as { count: number };
    if (existing.count > 0) return false;

    const now = 1787738400;
    db.exec('BEGIN IMMEDIATE');
    try {
      insertFolderRows(db, now);
      insertMailRows(db, now);
      insertContactRows(db);
      insertCalendarRows(db);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return true;
  } finally {
    db.close();
  }
}

export function openKaiyueFixtureDatabase(configDir: string, readOnly = true) {
  return new DatabaseSync(path.join(configDir, 'edgehill.db'), { readOnly });
}
