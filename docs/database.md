# Database Design

## Users Collection

```javascript
{
    _id,
    name,
    email,
    password,
    profilePicture,
    createdAt
}
```

## Interviews Collection

```javascript
{
    _id,
    userId,
    company,
    role,
    difficulty,
    score,
    feedback,
    createdAt
}
```

## Questions Collection

```javascript
{
    _id,
    company,
    role,
    topic,
    difficulty,
    question,
    answer
}
```

## Progress Collection

```javascript
{
    _id,
    userId,
    solvedQuestions,
    weakTopics,
    streak,
    accuracy
}
```