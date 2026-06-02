import ActivityKit
import ExpoModulesCore
import Foundation

public class ReactNativeWidgetExtensionModule: Module {
    private var activityId: String?

    public func definition() -> ModuleDefinition {
        Name("ReactNativeWidgetExtension")

        AsyncFunction("startActivity") { (data: [String: Any]) in
            guard #available(iOS 16.2, *) else { return }
            let attrs = BalanzaActivityAttributes(sessionId: UUID().uuidString)
            let state = BalanzaActivityAttributes.ContentState(
                speed:   data["speed"]   as? Double ?? 0,
                steps:   data["steps"]   as? Int    ?? 0,
                km:      data["km"]      as? Double ?? 0,
                seconds: data["seconds"] as? Int    ?? 0
            )
            let content = ActivityContent(state: state, staleDate: nil)
            if let activity = try? Activity.request(attributes: attrs, content: content) {
                self.activityId = activity.id
            }
        }

        AsyncFunction("updateActivity") { (data: [String: Any]) in
            guard #available(iOS 16.2, *) else { return }
            guard let id = self.activityId else { return }
            guard let activity = Activity<BalanzaActivityAttributes>.activities.first(where: { $0.id == id }) else { return }
            let state = BalanzaActivityAttributes.ContentState(
                speed:   data["speed"]   as? Double ?? 0,
                steps:   data["steps"]   as? Int    ?? 0,
                km:      data["km"]      as? Double ?? 0,
                seconds: data["seconds"] as? Int    ?? 0
            )
            await activity.update(ActivityContent(state: state, staleDate: nil))
        }

        AsyncFunction("endActivity") { () in
            guard #available(iOS 16.2, *) else { return }
            guard let id = self.activityId else { return }
            guard let activity = Activity<BalanzaActivityAttributes>.activities.first(where: { $0.id == id }) else { return }
            await activity.end(nil, dismissalPolicy: .immediate)
            self.activityId = nil
        }

        Function("areActivitiesEnabled") { () -> Bool in
            guard #available(iOS 16.2, *) else { return false }
            return ActivityAuthorizationInfo().areActivitiesEnabled
        }
    }
}
