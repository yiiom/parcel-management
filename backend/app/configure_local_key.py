"""在專案根目錄執行 python backend/app/configure_local_key.py；不輸出金鑰。"""
import base64
import secrets
from pathlib import Path

if __name__ == '__main__':
    path=Path(__file__).resolve().parents[2] / '.env'
    content=path.read_text(encoding='utf-8-sig')
    rows=content.splitlines()
    existing=next((line.split('=',1)[1] for line in rows if line.startswith('CODE_ENCRYPTION_KEY=')),None)
    if existing:
        print('金鑰已存在，未變更。')
    else:
        rows=[line for line in rows if not line.startswith('CODE_ENCRYPTION_KEY=')]
        rows.append('CODE_ENCRYPTION_KEY='+base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())
        path.write_text('\n'.join(rows)+'\n',encoding='utf-8')
        print('已新增本機加密金鑰，請妥善備份 .env；未顯示金鑰內容。')
