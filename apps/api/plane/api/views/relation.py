# Python imports
import json

# Django imports
from django.utils import timezone
from django.db.models import Q
from django.core.serializers.json import DjangoJSONEncoder

# Third party imports
from rest_framework.response import Response
from rest_framework import status

# Module imports
from .base import BaseAPIView
from plane.app.permissions import ProjectEntityPermission
from plane.app.serializers import IssueRelationSerializer, RelatedIssueSerializer
from plane.db.models import (
    Project,
    IssueRelation,
)
from plane.bgtasks.issue_activities_task import issue_activity
from plane.utils.issue_relation_mapper import get_actual_relation
from plane.utils.host import base_host


class IssueRelationListCreateAPIEndpoint(BaseAPIView):
    permission_classes = [ProjectEntityPermission]

    def get(self, request, slug, project_id, issue_id):
        issue_relations = (
            IssueRelation.objects.filter(
                Q(issue_id=issue_id) | Q(related_issue=issue_id)
            )
            .filter(workspace__slug=slug)
            .order_by("-created_at")
            .distinct()
        )

        blocking = issue_relations.filter(
            relation_type="blocked_by", related_issue_id=issue_id
        ).values_list("issue_id", flat=True)

        blocked_by = issue_relations.filter(
            relation_type="blocked_by", issue_id=issue_id
        ).values_list("related_issue_id", flat=True)

        duplicate = issue_relations.filter(
            issue_id=issue_id, relation_type="duplicate"
        ).values_list("related_issue_id", flat=True)

        duplicate_related = issue_relations.filter(
            related_issue_id=issue_id, relation_type="duplicate"
        ).values_list("issue_id", flat=True)

        relates_to = issue_relations.filter(
            issue_id=issue_id, relation_type="relates_to"
        ).values_list("related_issue_id", flat=True)

        relates_to_related = issue_relations.filter(
            related_issue_id=issue_id, relation_type="relates_to"
        ).values_list("issue_id", flat=True)

        start_after = issue_relations.filter(
            relation_type="start_before", related_issue_id=issue_id
        ).values_list("issue_id", flat=True)

        start_before = issue_relations.filter(
            relation_type="start_before", issue_id=issue_id
        ).values_list("related_issue_id", flat=True)

        finish_after = issue_relations.filter(
            relation_type="finish_before", related_issue_id=issue_id
        ).values_list("issue_id", flat=True)

        finish_before = issue_relations.filter(
            relation_type="finish_before", issue_id=issue_id
        ).values_list("related_issue_id", flat=True)

        response_data = {
            "blocking": [str(pk) for pk in blocking],
            "blocked_by": [str(pk) for pk in blocked_by],
            "duplicate": [str(pk) for pk in duplicate]
            + [str(pk) for pk in duplicate_related],
            "relates_to": [str(pk) for pk in relates_to]
            + [str(pk) for pk in relates_to_related],
            "start_after": [str(pk) for pk in start_after],
            "start_before": [str(pk) for pk in start_before],
            "finish_after": [str(pk) for pk in finish_after],
            "finish_before": [str(pk) for pk in finish_before],
        }

        return Response(response_data, status=status.HTTP_200_OK)

    def post(self, request, slug, project_id, issue_id):
        relation_type = request.data.get("relation_type", None)
        if relation_type is None:
            return Response(
                {"message": "Issue relation type is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        issues = request.data.get("issues", [])
        project = Project.objects.get(pk=project_id)

        issue_relation = IssueRelation.objects.bulk_create(
            [
                IssueRelation(
                    issue_id=(
                        issue
                        if relation_type
                        in ["blocking", "start_after", "finish_after"]
                        else issue_id
                    ),
                    related_issue_id=(
                        issue_id
                        if relation_type
                        in ["blocking", "start_after", "finish_after"]
                        else issue
                    ),
                    relation_type=get_actual_relation(relation_type),
                    project_id=project_id,
                    workspace_id=project.workspace_id,
                    created_by=request.user,
                    updated_by=request.user,
                )
                for issue in issues
            ],
            batch_size=10,
            ignore_conflicts=True,
        )

        issue_activity.delay(
            type="issue_relation.activity.created",
            requested_data=json.dumps(request.data, cls=DjangoJSONEncoder),
            actor_id=str(request.user.id),
            issue_id=str(issue_id),
            project_id=str(project_id),
            current_instance=None,
            epoch=int(timezone.now().timestamp()),
            notification=True,
            origin=base_host(request=request, is_app=True),
        )

        if relation_type in ["blocking", "start_after", "finish_after"]:
            return Response(
                RelatedIssueSerializer(issue_relation, many=True).data,
                status=status.HTTP_201_CREATED,
            )
        else:
            return Response(
                IssueRelationSerializer(issue_relation, many=True).data,
                status=status.HTTP_201_CREATED,
            )


class IssueRelationRemoveAPIEndpoint(BaseAPIView):
    permission_classes = [ProjectEntityPermission]

    def post(self, request, slug, project_id, issue_id):
        related_issue = request.data.get("related_issue", None)

        issue_relation = (
            IssueRelation.objects.filter(workspace__slug=slug)
            .filter(
                Q(issue_id=related_issue, related_issue_id=issue_id)
                | Q(issue_id=issue_id, related_issue_id=related_issue)
            )
            .first()
        )

        if issue_relation is None:
            return Response(
                {"error": "Relation not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        current_instance = json.dumps(
            IssueRelationSerializer(issue_relation).data,
            cls=DjangoJSONEncoder,
        )
        issue_relation.delete()

        issue_activity.delay(
            type="issue_relation.activity.deleted",
            requested_data=json.dumps(request.data, cls=DjangoJSONEncoder),
            actor_id=str(request.user.id),
            issue_id=str(issue_id),
            project_id=str(project_id),
            current_instance=current_instance,
            epoch=int(timezone.now().timestamp()),
            notification=True,
            origin=base_host(request=request, is_app=True),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
