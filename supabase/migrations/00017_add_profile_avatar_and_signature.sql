-- 添加头像和签名字段到profiles表
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signature TEXT;

-- 创建avatars存储桶
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "authenticated_users_can_upload_avatars" ON storage.objects;
DROP POLICY IF EXISTS "public_can_view_avatars" ON storage.objects;

-- 设置avatars存储桶策略：所有已登录用户可上传
CREATE POLICY "authenticated_users_can_upload_avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "public_can_view_avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');