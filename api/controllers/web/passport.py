import uuid

from flask import request
from flask_restful import Resource  # type: ignore
from werkzeug.exceptions import NotFound, Unauthorized, BadRequest

from controllers.web import api
from controllers.web.error import WebSSOAuthRequiredError
from extensions.ext_database import db
from libs.passport import PassportService
from models.model import Account, App, EndUser, Site
from services.enterprise.enterprise_service import EnterpriseService
from services.feature_service import FeatureService


class PassportResource(Resource):
    """Base resource for passport."""

    def get(self):
        system_features = FeatureService.get_system_features()
        app_code = request.headers.get("X-App-Code")
        # user_id = request.args.get("user_id")

        if app_code is None:
            raise Unauthorized("X-App-Code header is missing.")

        if system_features.sso_enforced_for_web:
            app_web_sso_enabled = EnterpriseService.get_app_web_sso_enabled(app_code).get("enabled", False)
            if app_web_sso_enabled:
                raise WebSSOAuthRequiredError()

        # get site from db and check if it is normal
        site = db.session.query(Site).filter(Site.code == app_code, Site.status == "normal").first()
        if not site:
            raise NotFound()
        # get app from db and check if it is normal and enable_site
        app_model = db.session.query(App).filter(App.id == site.app_id).first()
        if not app_model or app_model.status != "normal" or not app_model.enable_site:
            raise NotFound()
        
        # --- 开始: 插入你的核心定制逻辑 ---

        # 1. 获取并验证 Account ID
        account_id = request.headers.get("X-User-Id")
        print(f"account_id=====: {account_id}") # 保留调试信息（可选）

        if not account_id:
            # 在你的流程中，account_id 是必需的
            raise BadRequest("User account information is missing (X-User-Id header).")

        # 2. 验证 Account 记录是否存在 (重要)
        account = db.session.query(Account).filter(Account.id == account_id).first()
        if not account:
            # 如果根据 ID 找不到对应的 Account，则认证失败
            raise Unauthorized("Invalid user account provided.")

        # 3. 使用 "Shared ID" 查找或创建 EndUser
        shared_id = account_id
        end_user = db.session.query(EndUser).filter(EndUser.id == shared_id).first()

        if not end_user:
            print(f"--- Creating new EndUser with shared ID: {shared_id} ---", flush=True)
            try:
                # 检查 1.3.0 的 EndUser 模型是否包含 'type', 'name' 等字段
                # 如果没有 'type' 字段，你可能需要省略它，或考虑其他方式存储这个信息
                # 如果 session_id 生成方式有变，使用 1.3.0 的方式
                session_id_to_use = str(uuid.uuid4()) # 或者使用 1.3.0 的 generate_session_id() 如果它还在

                end_user = EndUser(
                    id=shared_id,  # 设置 EndUser.id 为 Account.id
                    tenant_id=app_model.tenant_id, # 从 app_model 获取
                    app_id=app_model.id,           # 从 app_model 获取
                    type='account_linked',         # 自定义类型，确认 1.3.0 模型支持
                    name=account.name if hasattr(account, 'name') else None, # 检查 Account 模型是否有 name
                    is_anonymous=False,            # 标记为非匿名
                    session_id=session_id_to_use   # 设置 session_id
                    # 确认 1.3.0 的 EndUser 模型是否需要其他必填字段
                )
                db.session.add(end_user)
                db.session.commit()
                # db.session.refresh(end_user) # 确认是否需要
            except Exception as e:
                db.session.rollback()
                print(f"Error creating EndUser with shared ID {shared_id}: {e}", flush=True)
                # 考虑更健壮的错误处理
                raise BadRequest(f"Failed to create linked user session: {e}") from e
        else:
            # 如果找到了，按需更新
            print(f"--- Found existing EndUser with shared ID: {shared_id} ---", flush=True)
            needs_update = False
            if getattr(end_user, 'is_anonymous', True): # 安全地检查 is_anonymous
                end_user.is_anonymous = False
                needs_update = True
            if getattr(end_user, 'type', None) != 'account_linked': # 安全地检查 type
                setattr(end_user, 'type', 'account_linked') # 使用 setattr 兼容不同版本
                needs_update = True
            account_name = getattr(account, 'name', None) # 安全地获取 account name
            if account_name and getattr(end_user, 'name', None) != account_name: # 安全地检查 end_user name
                setattr(end_user, 'name', account_name)
                needs_update = True
            # 考虑是否每次登录都更新 session_id? 如果需要取消下面注释
            # end_user.session_id = str(uuid.uuid4()) # 或使用 1.3.0 的生成方式
            # needs_update = True

            if needs_update:
                # 检查 1.3.0 是否有 updated_at 字段需要处理
                # from datetime import datetime, timezone
                # end_user.updated_at = datetime.now(timezone.utc)
                db.session.commit()
        # --- 结束: 插入你的核心定制逻辑 ---


        # --- 开始: 构建包含你自定义字段的 JWT Payload ---
        payload = {
            # 标准字段 (确认 1.3.0 需要哪些)
            "iss": site.app_id,
            "sub": "Web API Passport", # 使用 1.3.0 的 sub 或保持你的
            "app_id": site.app_id,
            "app_code": app_code, # 1.3.0 已包含此字段
            "end_user_id": end_user.id, # 关键：这里的值就是 shared_id / account_id

            # 你的自定义字段
            "account_id": account_id,
            "user_type": getattr(end_user, 'type', 'unknown') # 安全地获取类型
        }
        # --- 结束: 构建 JWT Payload ---

        # --- 注释掉原有逻辑 ---
        # if user_id:
        #     end_user = (
        #         db.session.query(EndUser).filter(EndUser.app_id == app_model.id, EndUser.session_id == user_id).first()
        #     )

        #     if end_user:
        #         pass
        #     else:
        #         end_user = EndUser(
        #             tenant_id=app_model.tenant_id,
        #             app_id=app_model.id,
        #             type="browser",
        #             is_anonymous=True,
        #             session_id=user_id,
        #         )
        #         db.session.add(end_user)
        #         db.session.commit()
        # else:
        #     end_user = EndUser(
        #         tenant_id=app_model.tenant_id,
        #         app_id=app_model.id,
        #         type="browser",
        #         is_anonymous=True,
        #         session_id=generate_session_id(),
        #     )
        #     db.session.add(end_user)
        #     db.session.commit()

        # payload = {
        #     "iss": site.app_id,
        #     "sub": "Web API Passport",
        #     "app_id": site.app_id,
        #     "app_code": app_code,
        #     "end_user_id": end_user.id,
        # }

        tk = PassportService().issue(payload)

        return {
            "access_token": tk,
        }


api.add_resource(PassportResource, "/passport")


def generate_session_id():
    """
    Generate a unique session ID.
    """
    while True:
        session_id = str(uuid.uuid4())
        existing_count = db.session.query(EndUser).filter(EndUser.session_id == session_id).count()
        if existing_count == 0:
            return session_id
