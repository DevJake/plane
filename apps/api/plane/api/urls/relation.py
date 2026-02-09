from django.urls import path

from plane.api.views import (
    IssueRelationListCreateAPIEndpoint,
    IssueRelationRemoveAPIEndpoint,
)

urlpatterns = [
    # Legacy issue paths
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/issue-relation/",
        IssueRelationListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="issue-relation",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/remove-relation/",
        IssueRelationRemoveAPIEndpoint.as_view(http_method_names=["post"]),
        name="issue-relation-remove",
    ),
    # New work-item paths
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/relations/",
        IssueRelationListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="work-item-relation-list",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/relations/remove/",
        IssueRelationRemoveAPIEndpoint.as_view(http_method_names=["post"]),
        name="work-item-relation-remove",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/remove-relation/",
        IssueRelationRemoveAPIEndpoint.as_view(http_method_names=["post"]),
        name="work-item-relation-remove-alt",
    ),
]
