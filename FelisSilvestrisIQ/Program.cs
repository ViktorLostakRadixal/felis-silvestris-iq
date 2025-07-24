using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using System.Text.Json;

// *****************************************************************************
// 1. SETUP AND LAUNCH THE WEB APPLICATION
// *****************************************************************************
var builder = WebApplication.CreateBuilder(args);

// Add services for Swagger/OpenAPI.
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Add the MongoDB service to the DI container.
builder.Services.AddSingleton<MongoDbService>(sp =>
{
    // !!! IMPORTANT: Replace this string with your actual MongoDB connection string !!!
    var connectionString = "mongodb://localhost:27017";
    var databaseName = "FelisSilvestrisDB";
    return new MongoDbService(connectionString, databaseName);
});

// Required for accessing HttpContext to get the IP address.
builder.Services.AddHttpContextAccessor();

var app = builder.Build();

// Configure the HTTP request pipeline.
// In a development environment, enable Swagger UI.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(); // This makes the Swagger UI available at /swagger
}


// Enable serving static files (HTML, CSS, JS) from the wwwroot folder.
// UseDefaultFiles must be called before UseStaticFiles to serve index.html as the default page.
app.UseDefaultFiles();
app.UseStaticFiles();


// *****************************************************************************
// 2. DEFINE THE API ENDPOINT
// *****************************************************************************

// Endpoint for receiving and saving logs from the experiment.
// Expects an HTTP POST request to /api/log with a JSON body.
app.MapPost("/api/log", async (
    [FromBody] SessionLog sessionData,
    [FromServices] MongoDbService dbService,
    HttpContext context) =>
{
    try
    {
        // Add server-side information that the client cannot know.
        sessionData.ServerTimestamp = DateTime.UtcNow;
        sessionData.IpAddress = context.Connection.RemoteIpAddress?.ToString();

        await dbService.LogSessionAsync(sessionData);

        // Returns a 200 OK status with a confirmation message.
        return Results.Ok(new { message = $"Session '{sessionData.SessionId}' was successfully recorded." });
    }
    catch (Exception ex)
    {
        // In case of an error, returns status 500 and the error message.
        Console.WriteLine($"Error writing to DB: {ex.Message}");
        return Results.Problem("An error occurred while writing to the database.", statusCode: 500);
    }
});


// Run the application.
app.Run();


// *****************************************************************************
// 3. DATA MODEL CLASSES
// *****************************************************************************

// Main class representing the entire record of one session.
public class SessionLog
{
    public Guid Id { get; set; } = Guid.NewGuid(); // Unique ID for the database
    public string SessionId { get; set; } = string.Empty; // User-provided ID
    public string MachineName { get; set; } = string.Empty; // Client-side machine name (if available)
    public string UserAgent { get; set; } = string.Empty;
    public DateTime ClientStartTime { get; set; }
    public DateTime ClientEndTime { get; set; }
    public DateTime ServerTimestamp { get; set; } // Time of receipt on the server
    public string? IpAddress { get; set; } // Client's IP address
    public List<LogEvent> Events { get; set; } = new List<LogEvent>();
}

// Generic class for a single logged event.
public class LogEvent
{
    public long Timestamp { get; set; } // Milliseconds since the start of the experiment
    public string EventType { get; set; } = string.Empty; // e.g., "Tap", "ViewportChange"
    public JsonElement Data { get; set; } // Flexible JSON data for different event types
}


// *****************************************************************************
// 4. SERVICE CLASS FOR MONGODB COMMUNICATION
// *****************************************************************************

public class MongoDbService
{
    private readonly IMongoCollection<SessionLog> _sessionsCollection;

    public MongoDbService(string connectionString, string databaseName)
    {
        var mongoClient = new MongoClient(connectionString);
        var mongoDatabase = mongoClient.GetDatabase(databaseName);
        _sessionsCollection = mongoDatabase.GetCollection<SessionLog>("ExperimentSessions");
    }

    public async Task LogSessionAsync(SessionLog sessionLog)
    {
        await _sessionsCollection.InsertOneAsync(sessionLog);
    }
}
