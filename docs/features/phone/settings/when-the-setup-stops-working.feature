@phone @settings @glasses
Feature: When a saved setup stops working

  A database can stop fitting its role later — it never had the properties the glasses need, or
  someone changed the schema — and that only shows up once a list or action actually fails in a
  configuration-shaped way. Unsharing or deleting a database is handled when settings reloads its
  list, not here.

  The app checks at most once per session: the first time a list refresh or a task or note action
  fails with a configuration-shaped error. Then it can open settings with the reason on screen.

  Background:
    Given the app was set up earlier
    And the glasses are connected

  Scenario: A list that fails to load for a configuration reason triggers a check
    Given opening a list fails because the chosen database is missing a property its role needs
    When I open that list
    Then the glasses first say the list couldn't load and to check the phone
    Or if cached rows are still on screen the header marks them "old"
    And the phone's status reads "Your Notion setup needs attention — check settings."
    And the phone's settings form opens on its own, with my previous choices still filled in
    And the database that no longer fits is flagged with what it's missing
    # "Setup needs attention. Continue on your phone." on the glasses appears only if the screen
    # redraws while the setup is still flagged — not necessarily on the first paint.

  Scenario: A task or note action that fails for the same reason triggers the same check
    Given marking a task done or deleting a note fails because a property its database needs is gone
    Then the same check runs once
    And settings can open on its own as above

  Scenario: Fixing the flagged database picks up where the list left off
    Given the phone opened settings on its own, as above
    When I choose a working database for the flagged slot
    And I tap "Save"
    Then the glasses return to the menu
    And the list that failed shows fresh data when I open it again

  Scenario: Backing out of the automatic prompt leaves the glasses message unchanged
    Given the phone opened settings on its own, as above
    When I back out without saving
    Then the glasses still show whatever they showed when the list failed
    And the phone status still reads "Your Notion setup needs attention — check settings."
    # Nothing is undone — the stored setup is exactly what it was before the check ran.

  Scenario: A plain network failure does not trigger this
    Given opening a list fails because the phone has no connection
    When I open that list
    Then the glasses say the list couldn't load and to check the phone
    But settings does not open on its own
    # Only a failure that looks configuration-shaped — not every failure — triggers a check.

  Scenario: A database I confirmed anyway does not reopen settings
    Given I confirmed that database for its slot with "Save anyway" in settings
    When opening its list fails because it is missing a property its role needs
    Then the glasses say the list couldn't load and to check the phone
    But settings does not open on its own
    # I already made this call. Raising it again every session would be nagging me about a
    # setup I chose on purpose — see choosing-the-databases.feature.

  Scenario: The check runs at most once per session
    Given the automatic check already ran once during this session
    When another list fails for the same configuration reason
    Then settings does not open again on its own
    # Re-checking on every subsequent failure would mean a network hiccup right after the first
    # check keeps reopening settings. Reopening the app starts a new session.
